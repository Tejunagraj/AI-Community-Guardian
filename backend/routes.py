"""
Flask Routes Module
Defines all API endpoints for the AI Community Guardian application
"""

import json
import os
import math
import uuid
import requests
from datetime import datetime
from flask import Blueprint, request, jsonify, current_app, session
from werkzeug.utils import secure_filename
from ai_service import analyze_image as ai_analyze_image, chat as ai_chat, generate_report as ai_generate_report
from feature_services import (
    ensure_feature_tables,
    add_status_history,
    get_status_history,
    update_complaint_resolution,
    get_complaint_map_data,
    detect_duplicate_complaint,
    build_risk_prediction,
    get_admin_dashboard_stats,
    get_analytics_dashboard_data,
    get_civic_predictions,
    add_notification,
    get_notifications,
    update_user_points,
    get_user_rewards,
    get_reward_leaderboard,
    translate_text,
)
from db import  (
    create_user,
    verify_user,
    add_complaint,
    get_reports_by_user,
    search_reports_by_user,
    get_report_dashboard_counts,
    get_report_by_id,
    get_all_complaints,
    update_complaint_status,
    is_admin_user,
    create_report,
    delete_report,
    add_session,
    delete_session,
    DATABASE_PATH,
    get_admin_complaints,
    update_admin_complaint,
    delete_admin_complaint,
)

# Create blueprint for routes
routes = Blueprint('routes', __name__)

# Configuration
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'uploads')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

# Ensure upload folder exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
ensure_feature_tables()


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def get_upload_path(filename):
    filename = secure_filename(filename)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_")
    return os.path.join(UPLOAD_FOLDER, timestamp + filename)


def get_ai_error_response():
    return jsonify({'success': False, 'error': 'AI service is temporarily unavailable.'}), 200


def get_authenticated_username():
    return session.get('username')


def normalize_priority(value):
    if not value:
        return 'Medium'
    value = str(value).strip().lower()
    if value in ['critical', 'high', 'medium', 'low']:
        return value.title()
    if any(word in value for word in ['garbage', 'fire', 'flood', 'accident', 'crash', 'emergency']):
        return 'Critical'
    if any(word in value for word in ['pothole', 'road', 'damage', 'water leakage', 'leakage', 'drain']):
        return 'High'
    if any(word in value for word in ['street light', 'signal', 'traffic']):
        return 'Medium'
    return 'Low'


def normalize_status(value):
    if not value:
        return 'New'
    mapping = {
        'new': 'New',
        'under review': 'Under Review',
        'in progress': 'In Progress',
        'resolved': 'Resolved',
        'submitted': 'New',
        'pending': 'New',
    }
    value = str(value).strip().lower()
    return mapping.get(value, 'New')


def normalize_department(value):
    if not value:
        return 'Municipal Corporation'
    value = str(value).strip().lower()
    if 'garbage' in value:
        return 'Municipal Corporation'
    if 'pothole' in value or 'road' in value or 'public works' in value:
        return 'Public Works Department'
    if 'street light' in value or 'electric' in value or 'power' in value:
        return 'Electricity Department'
    if 'water' in value or 'leak' in value or 'drainage' in value:
        return 'Water Supply Department'
    if 'fire' in value:
        return 'Fire Department'
    if 'crime' in value or 'police' in value:
        return 'Police Department'
    if 'medical' in value or 'health' in value:
        return 'Health Department'
    if 'municipal' in value or 'corporation' in value or 'civic' in value:
        return 'Municipal Corporation'
    return 'Municipal Corporation'


@routes.route('/api/user', methods=['GET'])
def current_user():
    return jsonify({'success': True, 'username': get_authenticated_username()}), 200
@routes.route('/api/config', methods=['GET'])
def config():
    return jsonify({
        'success': True,
        'appName': 'Community Guardian'
    }), 200


@routes.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'message': 'AI Community Guardian API is running',
        'ai_configured': bool(os.getenv('GROQ_API_KEY'))
    }), 200


@routes.route('/api/chat', methods=['POST'])
def chat():
    try:
        if not request.is_json:
            return jsonify({'success': False, 'error': 'Request must be JSON'}), 400

        data = request.get_json()
        user_message = data.get('message', '').strip()
        if not user_message:
            return jsonify({'success': False, 'error': 'Message cannot be empty'}), 400
        if len(user_message) > 5000:
            return jsonify({'success': False, 'error': 'Message is too long (max 5000 characters)'}), 400

        result = ai_chat(user_message)
        if result.get('success'):
            return jsonify({'success': True, 'response': result.get('response'), 'timestamp': datetime.now().isoformat()}), 200

        current_app.logger.error('Chat endpoint AI failure: %s', result.get('error'))
        return jsonify({'success': False, 'error': result.get('error', 'AI service is temporarily unavailable.')}), 200
    except Exception as e:
        current_app.logger.error('Chat endpoint error: %s', e)
        return jsonify({'success': False, 'error': 'AI service is temporarily unavailable.'}), 200


@routes.route('/api/analyze-image', methods=['POST'])
def analyze_image():
    try:
        if 'image' not in request.files:
            return jsonify({'success': False, 'error': 'No image file provided'}), 400

        file = request.files['image']
        if file.filename == '':
            return jsonify({'success': False, 'error': 'No file selected'}), 400
        if not allowed_file(file.filename):
            return jsonify({'success': False, 'error': f"Invalid file type. Allowed types: {', '.join(ALLOWED_EXTENSIONS)}"}), 400

        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        file.seek(0)
        if file_size > MAX_FILE_SIZE:
            return jsonify({'success': False, 'error': 'File too large. Maximum size: 10MB'}), 400

        file_path = get_upload_path(file.filename)
        file.save(file_path)

        result = ai_analyze_image(file_path)
        if result.get('success'):
            return jsonify({'success': True, 'analysis': result.get('analysis'), 'filename': os.path.basename(file_path), 'timestamp': datetime.now().isoformat()}), 200

        try:
            os.remove(file_path)
        except Exception:
            pass
        current_app.logger.error('Image analysis endpoint AI failure: %s', result.get('error'))
        return jsonify({'success': False, 'error': result.get('error', 'AI service is temporarily unavailable.')}), 200
    except Exception as e:
        current_app.logger.error('Image analysis endpoint error: %s', e)
        return jsonify({'success': False, 'error': 'AI service is temporarily unavailable.'}), 200


@routes.route('/api/generate-report', methods=['POST'])
def generate_report():
    try:
        username = get_authenticated_username()
        if not username:
            return jsonify({'success': False, 'error': 'Authentication required'}), 401

        if not request.is_json:
            return jsonify({'success': False, 'error': 'Request must be JSON'}), 400

        data = request.get_json()
        analysis = data.get('analysis')
        location = data.get('location', 'Not provided')
        if not analysis or (isinstance(analysis, str) and not analysis.strip()):
            return jsonify({'success': False, 'error': 'Analysis text is required'}), 400

        analysis_text = analysis if isinstance(analysis, str) else json.dumps(analysis)
        if len(analysis_text) > 20000:
            return jsonify({'success': False, 'error': 'Analysis text is too long'}), 400

        result = ai_generate_report(analysis_text, location=location)
        if not result.get('success'):
            current_app.logger.error('Report generation endpoint AI failure: %s', result.get('error'))
            return jsonify({'success': False, 'error': result.get('error', 'AI service is temporarily unavailable.')}), 200

        title = result.get('title') or 'Community Complaint Report'
        issue = result.get('issue') or 'Community issue'
        description = result.get('description') or analysis_text
        severity = result.get('severity') or 'Medium'
        priority = normalize_priority(result.get('priority'))
        location_text = result.get('location') or location
        recommended_action = result.get('recommended_action') or ''
        department = normalize_department(result.get('department'))
        status = normalize_status(result.get('status'))
        report_text = result.get('report_text') or result.get('report', '')

        report_id = create_report(
            username=username,
            title=title,
            issue=issue,
            description=description,
            severity=severity,
            priority=priority,
            location=location_text,
            recommended_action=recommended_action,
            department=department,
            status=status,
            report_text=report_text,
            analysis_text=analysis_text,
        )

        return jsonify({
            'success': True,
            'report': report_text,
            'report_id': report_id,
            'title': title,
            'issue': issue,
            'description': description,
            'severity': severity,
            'priority': priority,
            'location': location_text,
            'recommended_action': recommended_action,
            'department': department,
            'status': status,
            'timestamp': datetime.now().isoformat()
        }), 200
    except Exception as e:
        current_app.logger.error('Report generation endpoint error: %s', e)
        return jsonify({'success': False, 'error': 'Daily AI request limit has been reached.\nPlease try again later or contact the administrator.'}), 200
@routes.route('/api/emergency-services', methods=['GET'])
def emergency_services():
    try:
        latitude = request.args.get('latitude')
        longitude = request.args.get('longitude')

        def haversine(lat1, lon1, lat2, lon2):
            R = 6371.0
            phi1 = math.radians(float(lat1))
            phi2 = math.radians(float(lat2))
            dphi = math.radians(float(lat2) - float(lat1))
            dlambda = math.radians(float(lon2) - float(lon1))
            a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
            return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

        def query_overpass(lat, lon, radius=5000):
            overpass_url = 'https://overpass-api.de/api/interpreter'
            query = f'''[out:json][timeout:25];(
  node["amenity"="hospital"](around:{radius},{lat},{lon});
  way["amenity"="hospital"](around:{radius},{lat},{lon});
  node["amenity"="police"](around:{radius},{lat},{lon});
  way["amenity"="police"](around:{radius},{lat},{lon});
  node["amenity"="fire_station"](around:{radius},{lat},{lon});
  way["amenity"="fire_station"](around:{radius},{lat},{lon});
  node["emergency"="ambulance_station"](around:{radius},{lat},{lon});
  way["emergency"="ambulance_station"](around:{radius},{lat},{lon});
);
-out center;'''
            try:
                resp = requests.post(overpass_url, data={'data': query}, timeout=30)
                resp.raise_for_status()
                return resp.json()
            except Exception:
                return None

        default_services = [
            {
                'type': 'Hospital',
                'name': 'City General Hospital',
                'description': 'General hospital with emergency care',
                'phone': '108',
                'distance': '0.8 km',
                'available_24_7': True,
                'icon': '🏥',
                'lat': latitude,
                'lon': longitude
            },
            {
                'type': 'Police Station',
                'name': 'Central Police Station',
                'description': 'Local police emergency services',
                'phone': '112',
                'distance': '1.2 km',
                'available_24_7': True,
                'icon': '🚔',
                'lat': latitude,
                'lon': longitude
            },
            {
                'type': 'Fire Station',
                'name': 'City Fire Station',
                'description': 'Fire and rescue services',
                'phone': '101',
                'distance': '1.5 km',
                'available_24_7': True,
                'icon': '🚒',
                'lat': latitude,
                'lon': longitude
            },
            {
                'type': 'Ambulance',
                'name': 'Emergency Ambulance Service',
                'description': 'Rapid medical ambulance response',
                'phone': '108',
                'distance': '0.5 km',
                'available_24_7': True,
                'icon': '🚑',
                'lat': latitude,
                'lon': longitude
            }
        ]

        services = []
        if latitude and longitude:
            data = query_overpass(latitude, longitude)
            if data and 'elements' in data and data['elements']:
                for el in data['elements']:
                    tags = el.get('tags', {})
                    name = tags.get('name') or tags.get('operator') or tags.get('brand') or 'Unknown'
                    phone = tags.get('phone') or tags.get('contact:phone') or 'N/A'
                    street = tags.get('addr:street', '')
                    housenumber = tags.get('addr:housenumber', '')
                    city = tags.get('addr:city', '')
                    postcode = tags.get('addr:postcode', '')
                    state = tags.get('addr:state', '')
                    country = tags.get('addr:country', '')
                    locality = tags.get('addr:suburb', '')
                    address_parts = [part for part in [housenumber, street, locality or city, postcode, state, country] if part]
                    address = ', '.join(address_parts) if address_parts else tags.get('description') or tags.get('amenity') or 'Address not available'
                    service_type = tags.get('amenity') or tags.get('emergency') or 'Service'
                    if el.get('type') == 'node':
                        el_lat = el.get('lat')
                        el_lon = el.get('lon')
                    else:
                        center = el.get('center') or {}
                        el_lat = center.get('lat')
                        el_lon = center.get('lon')

                    if el_lat and el_lon:
                        dist_km = haversine(latitude, longitude, el_lat, el_lon)
                        icon = '🏥' if 'hospital' in service_type else '🚔' if 'police' in service_type else '🚒' if 'fire_station' in service_type else '🚑' if 'ambulance' in service_type else '🚨'
                        services.append({
                            'type': service_type,
                            'name': name,
                            'address': address,
                            'phone': phone,
                            'distance': f"{dist_km:.2f} km",
                            'available_24_7': True,
                            'icon': icon,
                            'lat': el_lat,
                            'lon': el_lon
                        })

        if not services:
            services = default_services

        return jsonify({'success': True, 'services': services}), 200
    except Exception as e:
        current_app.logger.error(f"Emergency services endpoint error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500


@routes.route('/api/emergency-numbers', methods=['GET'])
def emergency_numbers():
    try:
        emergency_contacts = [
            {'service': 'Police', 'number': '112', 'description': 'Police Emergency (National)', 'icon': '🚔'},
            {'service': 'Ambulance', 'number': '108', 'description': 'Emergency Ambulance Service', 'icon': '🚑'},
            {'service': 'Fire', 'number': '101', 'description': 'Fire Emergency', 'icon': '🚒'},
            {'service': 'Women Helpline', 'number': '1091', 'description': '24-Hour Women Help Line', 'icon': '👩'},
            {'service': 'Disaster Management', 'number': '1070', 'description': 'Disaster Management Authority', 'icon': '⚠️'},
            {'service': 'Child Helpline', 'number': '1098', 'description': '24-Hour Child Emergency Line', 'icon': '👶'},
            {'service': 'Poison Control', 'number': '1800-11-6117', 'description': 'National Poison Control Center', 'icon': '☠️'}
        ]
        return jsonify({'success': True, 'numbers': emergency_contacts}), 200
    except Exception as e:
        current_app.logger.error(f"Emergency numbers endpoint error: {e}")
        return jsonify({'success': False, 'error': 'Internal server error'}), 500


@routes.route('/api/register', methods=['POST'])
def register():
    if not request.is_json:
        return jsonify({'success': False, 'error': 'JSON required'}), 400
    data = request.get_json()
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()
    if not username or not password:
        return jsonify({'success': False, 'error': 'Username and password required'}), 400
    print(f'Register endpoint called for username: "{username}"')
    print('Database during registration (routes):', DATABASE_PATH)
    result = create_user(username, password, is_admin=False)
    if not result.get('success'):
        # Duplicate username
        if result.get('error') == 'username_exists':
            return jsonify({'success': False, 'error': 'Username already exists'}), 400
        # Other DB errors - expose message in debug mode, otherwise generic
        msg = result.get('message') or 'Error creating user'
        if current_app.debug:
            return jsonify({'success': False, 'error': msg}), 500
        else:
            return jsonify({'success': False, 'error': 'Error creating user'}), 500
    return jsonify({'success': True, 'message': 'User registered successfully'}), 201


@routes.route('/api/login', methods=['POST'])
def login():
    if not request.is_json:
        return jsonify({'success': False, 'error': 'JSON required'}), 400

    data = request.get_json()

    username = data.get('username', '').strip()
    password = data.get('password', '').strip()

    print("========== LOGIN ==========")
    print("Username:", username)
    print("Password:", password)

    result = verify_user(username, password)

    print("verify_user returned:", result)
    print("===========================")

    if result:
        session['username'] = username
        return jsonify({'success': True, 'message': 'Logged in'}), 200

    return jsonify({'success': False, 'error': 'Invalid credentials'}), 401


@routes.route('/api/logout', methods=['POST'])
def logout():
    session.pop('username', None)
    return jsonify({'success': True, 'message': 'Logged out'}), 200


@routes.route('/api/complaints', methods=['POST'])
def submit_complaint():
    username = session.get('username', 'anonymous')
    file_path = None
    location = ''

    if 'image' in request.files:
        file = request.files['image']
        if file and allowed_file(file.filename):
            file_path = get_upload_path(file.filename)
            file.save(file_path)
        else:
            return jsonify({'success': False, 'error': 'Invalid image upload'}), 400
        issue_type = request.form.get('issue_type', 'Unknown')
        severity = request.form.get('severity', 'Medium')
        priority = request.form.get('priority', 'Medium')
        department = request.form.get('department', '')
        description = request.form.get('description', '')
        location = request.form.get('location', '')
        latitude = request.form.get('latitude')
        longitude = request.form.get('longitude')
        duplicate_check = request.form.get('check_duplicate', 'true')
    else:
        if not request.is_json:
            return jsonify({'success': False, 'error': 'JSON required'}), 400
        data = request.get_json()
        issue_type = data.get('issue_type', 'Unknown')
        severity = data.get('severity', 'Medium')
        priority = data.get('priority', 'Medium')
        department = data.get('department', '')
        description = data.get('description', '')
        location = data.get('location', '')
        latitude = data.get('latitude')
        longitude = data.get('longitude')
        duplicate_check = data.get('check_duplicate', 'true')

    if str(duplicate_check).lower() != 'false':
        duplicate = detect_duplicate_complaint(username, issue_type, description, location)
        if duplicate:
            return jsonify({'success': False, 'duplicate': True, 'message': 'Similar complaint already exists', 'existing': duplicate}), 200

    cid = add_complaint(username, issue_type, severity, priority, department, description, file_path, latitude, longitude)
    create_report(
        username=username,
        title=issue_type or 'Community Complaint',
        issue=issue_type or 'Community issue',
        description=description or f"{issue_type} reported by {username}",
        severity=severity,
        priority=normalize_priority(priority),
        location=location,
        recommended_action='',
        department=normalize_department(department),
        status=normalize_status('New'),
        report_text=description or f"{issue_type} reported by {username}",
        analysis_text='',
    )
    add_status_history(cid, 'Submitted', 'Complaint submitted')
    add_notification(username, 'Complaint submitted', 'Your complaint has been received and is being reviewed.', 'info', cid)
    update_user_points(username, 10)
    return jsonify({'success': True, 'complaint_id': cid}), 201


@routes.route('/api/complaints', methods=['GET'])
def get_my_complaints():
    username = get_authenticated_username()
    if not username:
        return jsonify({'success': False, 'error': 'Authentication required'}), 401

    search = request.args.get('search')
    status = request.args.get('status') or None
    priority = request.args.get('priority') or None
    department = request.args.get('department') or None
    sort = request.args.get('sort', 'newest')

    rows = search_reports_by_user(
        username,
        search=search,
        status=normalize_status(status),
        priority=normalize_priority(priority) if priority else None,
        department=normalize_department(department) if department else None,
        sort=sort,
    )
    return jsonify({'success': True, 'complaints': rows}), 200


@routes.route('/api/complaints/stats', methods=['GET'])
def get_my_complaint_stats():
    username = get_authenticated_username()
    if not username:
        return jsonify({'success': False, 'error': 'Authentication required'}), 401

    stats = get_report_dashboard_counts(username)
    return jsonify({'success': True, 'stats': stats}), 200


@routes.route('/api/complaints/<int:report_id>', methods=['GET'])
def view_complaint(report_id):
    username = get_authenticated_username()
    if not username:
        return jsonify({'success': False, 'error': 'Authentication required'}), 401

    report = get_report_by_id(report_id, username)
    if not report:
        return jsonify({'success': False, 'error': 'Report not found'}), 404

    return jsonify({'success': True, 'report': report}), 200


@routes.route('/api/complaints/<int:report_id>', methods=['DELETE'])
def delete_complaint(report_id):
    username = get_authenticated_username()
    if not username:
        return jsonify({'success': False, 'error': 'Authentication required'}), 401
    deleted = delete_report(report_id, username)
    if deleted:
        return jsonify({'success': True, 'message': 'Complaint deleted successfully'}), 200
    return jsonify({'success': False, 'error': 'Complaint not found'}), 404


@routes.route('/api/admin/stats', methods=['GET'])
def admin_stats():
    username = get_authenticated_username()
    if not username or not is_admin_user(username):
        return jsonify({'success': False, 'error': 'Admin privileges required'}), 403
    complaints = get_all_complaints()
    total = len(complaints)
    pending = sum(1 for c in complaints if str(c.get('status') or '').lower() in {'new', 'under review', 'in progress', 'pending'})
    resolved = sum(1 for c in complaints if str(c.get('status') or '').lower() == 'resolved')
    critical = sum(1 for c in complaints if str(c.get('severity', '')).lower() == 'critical')
    recent = complaints[:10]
    return jsonify({'success': True, 'total': total, 'pending': pending, 'resolved': resolved, 'critical': critical, 'recent': recent}), 200


@routes.route('/api/admin/complaints', methods=['GET'])
def admin_complaints_list():
    username = get_authenticated_username()
    if not username or not is_admin_user(username):
        return jsonify({'success': False, 'error': 'Admin privileges required'}), 403
    complaints = get_admin_complaints()
    return jsonify({'success': True, 'complaints': complaints}), 200


@routes.route('/api/admin/complaints/<int:complaint_id>', methods=['GET'])
def admin_complaint_view(complaint_id):
    username = get_authenticated_username()
    if not username or not is_admin_user(username):
        return jsonify({'success': False, 'error': 'Admin privileges required'}), 403
    complaint = next((item for item in get_admin_complaints() if item.get('id') == complaint_id), None)
    if not complaint:
        return jsonify({'success': False, 'error': 'Complaint not found'}), 404
    return jsonify({'success': True, 'complaint': complaint}), 200


@routes.route('/api/admin/complaints/<int:complaint_id>', methods=['PUT'])
def admin_complaint_update(complaint_id):
    username = get_authenticated_username()
    if not username or not is_admin_user(username):
        return jsonify({'success': False, 'error': 'Admin privileges required'}), 403
    data = request.get_json(silent=True) or {}
    update_admin_complaint(
        complaint_id,
        title=data.get('title'),
        description=data.get('description'),
        priority=data.get('priority'),
        department=data.get('department'),
        status=data.get('status'),
        resolution_notes=data.get('resolution_notes'),
    )
    return jsonify({'success': True, 'message': 'Complaint updated'}), 200


@routes.route('/api/admin/complaints/<int:complaint_id>', methods=['DELETE'])
def admin_complaint_delete(complaint_id):
    username = get_authenticated_username()
    if not username or not is_admin_user(username):
        return jsonify({'success': False, 'error': 'Admin privileges required'}), 403
    deleted = delete_admin_complaint(complaint_id)
    if deleted:
        return jsonify({'success': True, 'message': 'Complaint deleted'}), 200
    return jsonify({'success': False, 'error': 'Complaint not found'}), 404


@routes.route('/api/admin/complaints/<int:complaint_id>/status', methods=['POST'])
def admin_complaint_status_update(complaint_id):
    username = get_authenticated_username()
    if not username or not is_admin_user(username):
        return jsonify({'success': False, 'error': 'Admin privileges required'}), 403
    data = request.get_json(silent=True) or {}
    new_status = data.get('status') or 'In Progress'
    update_admin_complaint(complaint_id, status=new_status)
    return jsonify({'success': True, 'message': 'Status updated'}), 200


@routes.route('/api/complaints/map', methods=['GET'])
def complaints_map():
    return jsonify({'success': True, 'complaints': get_complaint_map_data()}), 200


@routes.route('/api/complaints/<int:complaint_id>/status', methods=['GET'])
def complaint_status_history(complaint_id):
    username = get_authenticated_username()
    if not username:
        return jsonify({'success': False, 'error': 'Authentication required'}), 401
    return jsonify({'success': True, 'history': get_status_history(complaint_id)}), 200


@routes.route('/api/complaints/<int:complaint_id>/status', methods=['POST'])
def update_complaint_status_route(complaint_id):
    username = get_authenticated_username()
    if not username:
        return jsonify({'success': False, 'error': 'Authentication required'}), 401
    data = request.get_json(silent=True) or {}
    status = data.get('status') or 'In Progress'
    note = data.get('note') or ''
    update_complaint_status(complaint_id, status)
    add_status_history(complaint_id, status, note)
    add_notification(username, 'Complaint status updated', f'Your complaint status changed to {status}.', 'info', complaint_id)
    return jsonify({'success': True, 'message': 'Status updated'}), 200


@routes.route('/api/complaints/<int:complaint_id>/resolve', methods=['POST'])
def resolve_complaint_route(complaint_id):
    username = get_authenticated_username()
    if not username:
        return jsonify({'success': False, 'error': 'Authentication required'}), 401
    data = request.get_json(silent=True) or {}
    after_image_path = data.get('after_image_path')
    update_complaint_status(complaint_id, 'Resolved')
    update_complaint_resolution(complaint_id, after_image_path=after_image_path)
    add_status_history(complaint_id, 'Resolved', data.get('note') or 'Complaint resolved')
    add_notification(username, 'Complaint resolved', 'Your complaint has been marked as resolved.', 'success', complaint_id)
    update_user_points(username, 25)
    return jsonify({'success': True, 'message': 'Complaint resolved'}), 200


@routes.route('/api/complaints/risk-analysis', methods=['POST'])
def risk_analysis_route():
    data = request.get_json(silent=True) or {}
    analysis_text = data.get('analysis') or ''
    issue_type = data.get('issue_type') or ''
    return jsonify({'success': True, 'risk': build_risk_prediction(analysis_text, issue_type)}), 200


@routes.route('/api/dashboard/admin', methods=['GET'])
def admin_dashboard_route():
    return jsonify({'success': True, 'stats': get_admin_dashboard_stats()}), 200


@routes.route('/api/dashboard/analytics', methods=['GET'])
def analytics_dashboard_route():
    return jsonify({'success': True, 'stats': get_analytics_dashboard_data()}), 200


@routes.route('/api/dashboard/predictions', methods=['GET'])
def civic_predictions_route():
    return jsonify({'success': True, 'predictions': get_civic_predictions()}), 200


@routes.route('/api/notifications', methods=['GET'])
def notifications_route():
    username = get_authenticated_username()
    if not username:
        return jsonify({'success': False, 'error': 'Authentication required'}), 401
    return jsonify({'success': True, 'notifications': get_notifications(username)}), 200


@routes.route('/api/rewards', methods=['GET'])
def rewards_route():
    username = get_authenticated_username()
    if not username:
        return jsonify({'success': False, 'error': 'Authentication required'}), 401
    return jsonify({'success': True, 'rewards': get_user_rewards(username), 'leaderboard': get_reward_leaderboard()}), 200


@routes.route('/api/translate', methods=['POST'])
def translate_route():
    data = request.get_json(silent=True) or {}
    text = data.get('text') or ''
    language = data.get('language') or 'en'
    return jsonify({'success': True, 'translated_text': translate_text(text, language)}), 200

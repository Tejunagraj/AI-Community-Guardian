import json
import math
import re
import sqlite3
from datetime import datetime
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / 'guardian.db'


def get_conn():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def ensure_feature_tables():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute('''
        CREATE TABLE IF NOT EXISTS complaint_status_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            complaint_id INTEGER NOT NULL,
            status TEXT NOT NULL,
            note TEXT,
            created_at TEXT NOT NULL
        )
    ''')
    cur.execute('''
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            kind TEXT DEFAULT 'info',
            complaint_id INTEGER,
            is_read INTEGER DEFAULT 0,
            created_at TEXT NOT NULL
        )
    ''')
    cur.execute('''
        CREATE TABLE IF NOT EXISTS civic_predictions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            prediction_type TEXT NOT NULL,
            summary TEXT NOT NULL,
            details TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    ''')
    cur.execute('PRAGMA table_info(users)')
    user_columns = [row[1] for row in cur.fetchall()]
    if 'points' not in user_columns:
        cur.execute('ALTER TABLE users ADD COLUMN points INTEGER DEFAULT 0')
    if 'badge' not in user_columns:
        cur.execute("ALTER TABLE users ADD COLUMN badge TEXT DEFAULT 'Bronze'")
    cur.execute('PRAGMA table_info(complaints)')
    complaint_columns = [row[1] for row in cur.fetchall()]
    if 'after_image_path' not in complaint_columns:
        cur.execute('ALTER TABLE complaints ADD COLUMN after_image_path TEXT')
    if 'resolved_at' not in complaint_columns:
        cur.execute('ALTER TABLE complaints ADD COLUMN resolved_at TEXT')
    conn.commit()
    conn.close()


def add_status_history(complaint_id, status, note=''):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        'INSERT INTO complaint_status_history (complaint_id, status, note, created_at) VALUES (?, ?, ?, ?)',
        (complaint_id, status, note, datetime.utcnow().isoformat())
    )
    conn.commit()
    conn.close()


def get_status_history(complaint_id):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute('SELECT status, note, created_at FROM complaint_status_history WHERE complaint_id = ? ORDER BY id ASC', (complaint_id,))
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows


def get_complaint_map_data():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute('''
        SELECT id, username, issue_type, description, severity, priority, department, status, location, latitude, longitude, created_at
        FROM complaints
        WHERE latitude IS NOT NULL AND longitude IS NOT NULL
        ORDER BY created_at DESC
    ''')
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows


def detect_duplicate_complaint(username, issue_type, description, location):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute('''
        SELECT id, title, issue_type, description, location, created_at
        FROM complaints
        WHERE username = ? OR username IS NULL
        ORDER BY created_at DESC
        LIMIT 20
    ''', (username,))
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    if not rows:
        return None

    target_text = ' '.join([issue_type or '', description or '', location or '']).lower()
    target_tokens = set(re.findall(r'[a-z0-9]+', target_text))
    for row in rows:
        source_text = ' '.join([row.get('issue_type') or '', row.get('description') or '', row.get('location') or '']).lower()
        source_tokens = set(re.findall(r'[a-z0-9]+', source_text))
        overlap = len(target_tokens & source_tokens)
        same_location = bool(location and row.get('location') and location.lower() == row.get('location').lower())
        same_issue = bool(issue_type and row.get('issue_type') and issue_type.lower() == row.get('issue_type').lower())
        if overlap >= 2 and (same_location or same_issue):
            return {
                'id': row['id'],
                'title': row.get('title') or row.get('issue_type') or 'Existing complaint',
                'location': row.get('location') or 'Unknown',
                'description': row.get('description') or '',
                'created_at': row.get('created_at'),
            }
    return None


def build_risk_prediction(analysis_text, issue_type=''):
    text = ' '.join([issue_type or '', analysis_text or '']).lower()
    severity = 'Low'
    if any(keyword in text for keyword in ['fire', 'gas leak', 'chemical', 'explosion', 'collapse', 'severe', 'critical', 'urgent']):
        severity = 'Critical'
    elif any(keyword in text for keyword in ['flood', 'accident', 'broken', 'waste', 'drainage', 'pothole', 'electric', 'health']):
        severity = 'High'
    elif any(keyword in text for keyword in ['noise', 'light', 'parking', 'tree', 'road']):
        severity = 'Medium'

    consequences = []
    if 'fire' in text or 'gas' in text:
        consequences.append('Rapid spread of fire or toxic exposure')
    if 'flood' in text:
        consequences.append('Waterlogging and blocked access routes')
    if 'health' in text or 'waste' in text or 'garbage' in text:
        consequences.append('Potential disease outbreak and sanitation issues')
    if 'road' in text or 'pothole' in text or 'accident' in text:
        consequences.append('Traffic disruption and pedestrian risk')
    if not consequences:
        consequences.append('Local inconvenience and increased service burden')

    hazards = []
    if 'water' in text or 'drain' in text:
        hazards.append('Waterborne contamination risk')
    if 'garbage' in text or 'waste' in text:
        hazards.append('Mosquito breeding and unhygienic conditions')
    if 'electric' in text or 'power' in text:
        hazards.append('Electrical shock hazard')
    if 'chemical' in text or 'fire' in text:
        hazards.append('Toxic inhalation or burn risk')
    if not hazards:
        hazards.append('Exposure to poor environmental conditions')

    actions = []
    if severity == 'Critical':
        actions.append('Call emergency services immediately if life safety is at risk')
        actions.append('Restrict access and alert nearby residents')
    elif severity == 'High':
        actions.append('Notify the relevant department without delay')
        actions.append('Secure the area and warn nearby residents')
    else:
        actions.append('Document the issue and submit it promptly')
        actions.append('Monitor the area until authorities respond')

    if 'health' in text or 'garbage' in text:
        actions.append('Arrange sanitation or public health support')

    if severity == 'Critical':
        resolution = '1-2 days'
    elif severity == 'High':
        resolution = '2-5 days'
    elif severity == 'Medium':
        resolution = '5-10 days'
    else:
        resolution = '10-14 days'

    return {
        'risk_level': severity,
        'possible_consequences': consequences,
        'health_hazards': hazards,
        'recommended_immediate_action': actions[0],
        'recommended_actions': actions,
        'estimated_resolution_time': resolution,
    }


def get_admin_dashboard_stats():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute('SELECT id, status, severity, priority, department, created_at FROM complaints ORDER BY created_at DESC')
    complaints = [dict(r) for r in cur.fetchall()]
    conn.close()
    total = len(complaints)
    resolved = sum(1 for c in complaints if str(c.get('status', '')).lower() in {'resolved', 'complete', 'done'})
    pending = sum(1 for c in complaints if str(c.get('status', '')).lower() not in {'resolved', 'complete', 'done', 'rejected'})
    critical = sum(1 for c in complaints if str(c.get('severity', '')).lower() == 'critical')
    department_counts = {}
    for complaint in complaints:
        dept = complaint.get('department') or 'Unassigned'
        department_counts[dept] = department_counts.get(dept, 0) + 1
    monthly_counts = {}
    for complaint in complaints:
        created_at = complaint.get('created_at')
        if not created_at:
            continue
        try:
            dt = datetime.fromisoformat(created_at)
            month = dt.strftime('%Y-%m')
            monthly_counts[month] = monthly_counts.get(month, 0) + 1
        except Exception:
            continue
    recent = complaints[:10]
    return {
        'total': total,
        'resolved': resolved,
        'pending': pending,
        'critical': critical,
        'department_counts': department_counts,
        'monthly_counts': monthly_counts,
        'recent': recent,
    }


def get_analytics_dashboard_data():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute('SELECT id, issue_type, department, priority, severity, status, created_at, resolved_at FROM complaints ORDER BY created_at DESC')
    complaints = [dict(r) for r in cur.fetchall()]
    conn.close()
    monthly_counts = {}
    issue_counts = {}
    department_counts = {}
    priority_counts = {}
    resolution_times = []
    for complaint in complaints:
        created_at = complaint.get('created_at')
        resolved_at = complaint.get('resolved_at')
        if created_at:
            try:
                month = datetime.fromisoformat(created_at).strftime('%Y-%m')
                monthly_counts[month] = monthly_counts.get(month, 0) + 1
            except Exception:
                pass
        issue = complaint.get('issue_type') or 'Unknown'
        issue_counts[issue] = issue_counts.get(issue, 0) + 1
        dept = complaint.get('department') or 'Unassigned'
        department_counts[dept] = department_counts.get(dept, 0) + 1
        priority = complaint.get('priority') or 'Medium'
        priority_counts[priority] = priority_counts.get(priority, 0) + 1
        if created_at and resolved_at:
            try:
                start = datetime.fromisoformat(created_at)
                end = datetime.fromisoformat(resolved_at)
                delta = (end - start).days
                if delta >= 0:
                    resolution_times.append(delta)
            except Exception:
                pass
    avg_resolution = round(sum(resolution_times) / len(resolution_times), 1) if resolution_times else 0
    return {
        'monthly_counts': monthly_counts,
        'issue_counts': issue_counts,
        'department_counts': department_counts,
        'priority_counts': priority_counts,
        'average_resolution_days': avg_resolution,
    }


def get_civic_predictions():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute('SELECT location, issue_type, status FROM complaints ORDER BY created_at DESC LIMIT 100')
    complaints = [dict(r) for r in cur.fetchall()]
    conn.close()
    hotspots = []
    for complaint in complaints:
        location = complaint.get('location') or 'Unknown'
        if location not in [item['location'] for item in hotspots]:
            hotspots.append({'location': location, 'count': 1})
        else:
            for item in hotspots:
                if item['location'] == location:
                    item['count'] += 1
                    break
    hotspots = sorted(hotspots, key=lambda item: item['count'], reverse=True)[:5]
    disease_risk = 'Moderate' if any('garbage' in (c.get('issue_type') or '').lower() for c in complaints) else 'Low'
    garbage_risk = 'High' if any('garbage' in (c.get('issue_type') or '').lower() for c in complaints) else 'Moderate'
    flood_risk = 'Moderate' if any('water' in (c.get('issue_type') or '').lower() for c in complaints) else 'Low'
    recommendations = []
    if disease_risk != 'Low':
        recommendations.append('Increase sanitation sweeps and mosquito-control checks')
    if flood_risk != 'Low':
        recommendations.append('Inspect drains and low-lying areas before the next rain')
    if hotspots:
        recommendations.append('Deploy inspection teams to the most repeated complaint locations')
    return {
        'hotspots': hotspots,
        'disease_risk': disease_risk,
        'garbage_accumulation': garbage_risk,
        'flood_risk': flood_risk,
        'recommendations': recommendations,
    }


def update_complaint_resolution(complaint_id, after_image_path=None, note=''):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute('UPDATE complaints SET status = ?, resolved_at = ?, after_image_path = ? WHERE id = ?', ('Resolved', datetime.utcnow().isoformat(), after_image_path, complaint_id))
    conn.commit()
    conn.close()


def add_notification(username, title, message, kind='info', complaint_id=None):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        'INSERT INTO notifications (username, title, message, kind, complaint_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        (username, title, message, kind, complaint_id, datetime.utcnow().isoformat())
    )
    conn.commit()
    conn.close()


def get_notifications(username):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute('SELECT id, title, message, kind, complaint_id, created_at FROM notifications WHERE username = ? ORDER BY id DESC LIMIT 10', (username,))
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows


def update_user_points(username, delta, badge=None):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute('SELECT points, badge FROM users WHERE username = ?', (username,))
    row = cur.fetchone()
    if not row:
        conn.close()
        return None
    current_points = int(row['points'] or 0) + delta
    if current_points < 0:
        current_points = 0
    if badge is None:
        if current_points >= 500:
            badge = 'Gold'
        elif current_points >= 200:
            badge = 'Silver'
        else:
            badge = 'Bronze'
    cur.execute('UPDATE users SET points = ?, badge = ? WHERE username = ?', (current_points, badge, username))
    conn.commit()
    conn.close()
    return {'points': current_points, 'badge': badge}


def get_user_rewards(username):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute('SELECT points, badge FROM users WHERE username = ?', (username,))
    row = cur.fetchone()
    conn.close()
    return dict(row) if row else {'points': 0, 'badge': 'Bronze'}


def get_reward_leaderboard(limit=10):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute('SELECT username, points, badge FROM users WHERE points > 0 ORDER BY points DESC, username ASC LIMIT ?', (limit,))
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows


def translate_text(text, language='en'):
    if not text or not isinstance(text, str):
        return text
    if language in (None, '', 'en'):
        return text
    replacements = {
        'en': {},
        'hi': {
            'Report': 'रिपोर्ट',
            'Complaint': 'शिकायत',
            'Status': 'स्थिति',
            'Resolved': 'हल हो गया',
            'Pending': 'लंबित',
            'Critical': 'गंभीर',
            'Department': 'विभाग',
            'Location': 'स्थान',
            'Analysis': 'विश्लेषण',
            'Risk Level': 'जोखिम स्तर',
            'Recommended Immediate Action': 'तत्काल अनुशंसित कार्रवाई',
            'Estimated Resolution Time': 'अनुमानित समाधान समय',
            'Health Hazards': 'स्वास्थ्य जोखिम',
            'Possible Consequences': 'संभावित परिणाम',
        },
        'kn': {
            'Report': 'ವರದಿ',
            'Complaint': 'ದೂರು',
            'Status': 'ಸ್ಥಿತಿ',
            'Resolved': 'ಪರಿಹರಿಸಲಾಗಿದೆ',
            'Pending': 'ಬಾಕಿ',
            'Critical': 'ಗಂಭೀರ',
            'Department': 'ವಿಭಾಗ',
            'Location': 'ಸ್ಥಳ',
            'Analysis': 'विश್ಲೇಷಣೆ',
            'Risk Level': 'ಅಪಾಯ ಮಟ್ಟ',
            'Recommended Immediate Action': 'ತಕ್ಷಣದ ಶಿಫಾರಸು ಮಾಡಲಾದ ಕ್ರಮ',
            'Estimated Resolution Time': 'ಅಂದಾಜು ಪರಿಹಾರ ಸಮಯ',
            'Health Hazards': 'ಆರೋಗ್ಯ ಅಪಾಯಗಳು',
            'Possible Consequences': 'ಸಂಭಾವ್ಯ ಪರಿಣಾಮಗಳು',
        },
    }
    mapping = replacements.get(language, {})
    translated = text
    for src, target in mapping.items():
        translated = translated.replace(src, target)
    return translated

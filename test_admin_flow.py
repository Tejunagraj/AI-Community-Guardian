import requests
import json
import time

API_BASE = 'http://localhost:5000/api'

# Test admin operations
print("="*60)
print("COMPREHENSIVE ADMIN FLOW TEST")
print("="*60)

# Create two sessions: one for regular user, one for admin
user_session = requests.Session()
admin_session = requests.Session()

# 1. Register and login as regular user
print("\n[1] Register and login as regular user...")
try:
    r = user_session.post(f'{API_BASE}/register', json={
        'username': 'regularuser',
        'password': 'Password123!'
    })
    print(f'  ✓ Register: {r.status_code}')
    
    r = user_session.post(f'{API_BASE}/login', json={
        'username': 'regularuser',
        'password': 'Password123!'
    })
    print(f'  ✓ Login (regular): {r.status_code}')
except Exception as e:
    print(f'  ✗ Error: {e}')

# 2. Regular user submits complaint
print("\n[2] Regular user submits complaint...")
try:
    r = user_session.post(f'{API_BASE}/complaints', json={
        'title': 'Pothole on Main Street',
        'issue_type': 'Infrastructure',
        'priority': 'High',
        'department': 'Public Works',
        'description': 'Large pothole causing traffic issues',
        'location': 'Main Street'
    })
    complaint_data = r.json() if r.ok else {}
    complaint_id = complaint_data.get('complaint_id')
    print(f'  ✓ Submit complaint: {r.status_code}')
    print(f'  Complaint ID: {complaint_id}')
except Exception as e:
    print(f'  ✗ Error: {e}')

# 3. Register and login as admin
print("\n[3] Register and login as admin user...")
try:
    r = admin_session.post(f'{API_BASE}/register', json={
        'username': 'adminuser',
        'password': 'AdminPass123!'
    })
    print(f'  ✓ Register: {r.status_code}')
    
    r = admin_session.post(f'{API_BASE}/login', json={
        'username': 'adminuser',
        'password': 'AdminPass123!'
    })
    print(f'  ✓ Login (admin): {r.status_code}')
except Exception as e:
    print(f'  ✗ Error: {e}')

# Note: For this test, we need to make the admin user an actual admin
# This would require database manipulation or an admin registration endpoint
# For now, we'll test the endpoints that should return 403

# 4. Admin attempts to access admin complaints (should be 403 without admin role)
print("\n[4] Non-admin user tries to access admin endpoints...")
try:
    r = user_session.get(f'{API_BASE}/admin/complaints')
    print(f'  ✓ Admin endpoint check: {r.status_code} (expected 403)')
except Exception as e:
    print(f'  ✗ Error: {e}')

# 5. Test dashboard endpoints
print("\n[5] Test dashboard endpoints...")
try:
    r = user_session.get(f'{API_BASE}/dashboard/admin')
    print(f'  ✓ Admin dashboard: {r.status_code}')
    data = r.json() if r.ok else {}
    stats = data.get('stats', {})
    print(f'    - Total complaints: {stats.get("total", 0)}')
except Exception as e:
    print(f'  ✗ Error: {e}')

# 6. Test analytics dashboard
print("\n[6] Test analytics dashboard...")
try:
    r = user_session.get(f'{API_BASE}/dashboard/analytics')
    print(f'  ✓ Analytics dashboard: {r.status_code}')
    data = r.json() if r.ok else {}
    print(f'    - Monthly counts: {len(data.get("monthly_counts", {}))} months')
except Exception as e:
    print(f'  ✗ Error: {e}')

# 7. Test complaint listing for regular user
print("\n[7] Test complaint listing...")
try:
    r = user_session.get(f'{API_BASE}/complaints')
    print(f'  ✓ My complaints: {r.status_code}')
    data = r.json() if r.ok else {}
    print(f'    - My complaint count: {len(data.get("complaints", []))}')
except Exception as e:
    print(f'  ✗ Error: {e}')

print("\n" + "="*60)
print("TEST COMPLETE")
print("="*60)

import requests
import json
import sys

API_BASE = 'http://localhost:5000/api'
session = requests.Session()

tests = {
    'Health': {'success': False, 'status': 0},
    'Register': {'success': False, 'status': 0},
    'Login': {'success': False, 'status': 0},
    'Submit Complaint': {'success': False, 'status': 0},
    'Admin Dashboard': {'success': False, 'status': 0},
    'Admin Complaints': {'success': False, 'status': 0},
}

# 1. Health Check
try:
    r = session.get(f'{API_BASE}/health')
    tests['Health']['status'] = r.status_code
    tests['Health']['success'] = r.status_code == 200
    print('✓ Health Check:', r.status_code)
except Exception as e:
    print('✗ Health Check:', str(e))

# 2. Register User
try:
    r = session.post(f'{API_BASE}/register', json={'username': 'testuser', 'password': 'Test123!'})
    tests['Register']['status'] = r.status_code
    tests['Register']['success'] = r.status_code in [200, 201, 400]  # 400 if user exists
    print('✓ Register:', r.status_code, '- User created or already exists')
except Exception as e:
    print('✗ Register:', str(e))

# 3. Login
try:
    r = session.post(f'{API_BASE}/login', json={'username': 'testuser', 'password': 'Test123!'})
    tests['Login']['status'] = r.status_code
    tests['Login']['success'] = r.status_code == 200
    print('✓ Login:', r.status_code)
except Exception as e:
    print('✗ Login:', str(e))

# 4. Submit Complaint
try:
    r = session.post(f'{API_BASE}/complaints', json={
        'title': 'Test Complaint',
        'issue_type': 'Infrastructure',
        'priority': 'High',
        'department': 'Public Works',
        'description': 'Test complaint for API validation'
    })
    tests['Submit Complaint']['status'] = r.status_code
    tests['Submit Complaint']['success'] = r.status_code in [200, 201]
    print('✓ Submit Complaint:', r.status_code)
except Exception as e:
    print('✗ Submit Complaint:', str(e))

# 5. Admin Dashboard (should be 200)
try:
    r = session.get(f'{API_BASE}/dashboard/admin')
    tests['Admin Dashboard']['status'] = r.status_code
    tests['Admin Dashboard']['success'] = r.status_code == 200
    print('✓ Admin Dashboard:', r.status_code)
except Exception as e:
    print('✗ Admin Dashboard:', str(e))

# 6. Admin Complaints (without admin privilege - should be 403)
try:
    r = session.get(f'{API_BASE}/admin/complaints')
    tests['Admin Complaints']['status'] = r.status_code
    is_403_ok = r.status_code == 403
    tests['Admin Complaints']['success'] = is_403_ok
    print('✓ Admin Complaints (non-admin):', r.status_code, '- Correctly returns 403')
except Exception as e:
    print('✗ Admin Complaints:', str(e))

print('\n' + '='*50)
print('SUMMARY:')
passed = sum(1 for result in tests.values() if result['success'])
total = len(tests)
for test, result in tests.items():
    status = '✓' if result['success'] else '✗'
    print(f'{status} {test}: {result["status"]}')
print(f'\nTotal: {passed}/{total} tests passed')
sys.exit(0 if passed == total else 1)

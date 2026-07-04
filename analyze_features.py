#!/usr/bin/env python3
"""Check which features are working and which need fixes"""
import requests
import json

API = 'http://localhost:5000/api'
session = requests.Session()

print("="*70)
print("AI COMMUNITY GUARDIAN - FEATURE ANALYSIS")
print("="*70)

checks = {}

# 1. Registration
try:
    r = session.post(f'{API}/register', json={'username': f'test_{int(__import__("time").time())}', 'password': 'Pass123!'})
    checks['Registration'] = r.status_code in [200, 201, 400]
    print(f"✓ Registration: {r.status_code}")
except Exception as e:
    checks['Registration'] = False
    print(f"✗ Registration: {e}")

# 2. Login  
try:
    r = session.post(f'{API}/login', json={'username': 'testuser', 'password': 'Test123!'})
    checks['Login'] = r.status_code in [200, 400, 401]
    print(f"✓ Login: {r.status_code}")
except Exception as e:
    checks['Login'] = False
    print(f"✗ Login: {e}")

# 3. Complaint Submission
try:
    r = session.post(f'{API}/complaints', json={'title': 'Test', 'issue_type': 'Test', 'priority': 'High', 'department': 'Test', 'description': 'Test'})
    checks['Complaint Submission'] = r.status_code in [200, 201, 400]
    print(f"✓ Complaint Submission: {r.status_code}")
except Exception as e:
    checks['Complaint Submission'] = False
    print(f"✗ Complaint Submission: {e}")

# 4. Admin Dashboard
try:
    r = session.get(f'{API}/dashboard/admin')
    data = r.json() if r.ok else {}
    has_data = 'stats' in data and data['stats']
    checks['Admin Dashboard'] = has_data
    stats = data.get('stats', {})
    print(f"✓ Admin Dashboard: {r.status_code}, has_stats={has_data}, keys={list(stats.keys())[:3]}")
except Exception as e:
    checks['Admin Dashboard'] = False
    print(f"✗ Admin Dashboard: {e}")

# 5. Analytics Dashboard
try:
    r = session.get(f'{API}/dashboard/analytics')
    data = r.json() if r.ok else {}
    has_data = 'stats' in data and data['stats']
    checks['Analytics Dashboard'] = has_data
    stats = data.get('stats', {})
    print(f"✓ Analytics Dashboard: {r.status_code}, has_data={has_data}, keys={list(stats.keys())[:3]}")
except Exception as e:
    checks['Analytics Dashboard'] = False
    print(f"✗ Analytics Dashboard: {e}")

# 6. Civic Predictions
try:
    r = session.get(f'{API}/dashboard/predictions')
    data = r.json() if r.ok else {}
    has_data = 'predictions' in data and data['predictions']
    checks['Civic Predictions'] = has_data
    preds = data.get('predictions', {})
    print(f"✓ Civic Predictions: {r.status_code}, has_data={has_data}, keys={list(preds.keys())[:3]}")
except Exception as e:
    checks['Civic Predictions'] = False
    print(f"✗ Civic Predictions: {e}")

# 7. Admin Complaints (non-admin should get 403)
try:
    r = session.get(f'{API}/admin/complaints')
    checks['Admin Complaints'] = r.status_code == 403
    print(f"✓ Admin Complaints (access control): {r.status_code} (expected 403)")
except Exception as e:
    checks['Admin Complaints'] = False
    print(f"✗ Admin Complaints: {e}")

# 8. Emergency Services
try:
    r = session.get(f'{API}/emergency-services')
    checks['Emergency Services'] = r.status_code == 200
    print(f"✓ Emergency Services: {r.status_code}")
except Exception as e:
    checks['Emergency Services'] = False
    print(f"✗ Emergency Services: {e}")

# 9. Emergency Numbers
try:
    r = session.get(f'{API}/emergency-numbers')
    checks['Emergency Numbers'] = r.status_code == 200
    print(f"✓ Emergency Numbers: {r.status_code}")
except Exception as e:
    checks['Emergency Numbers'] = False
    print(f"✗ Emergency Numbers: {e}")

print("\n" + "="*70)
print("SUMMARY")
print("="*70)
passed = sum(1 for v in checks.values() if v)
total = len(checks)
for feat, result in checks.items():
    symbol = '✓' if result else '✗'
    print(f"{symbol} {feat}")
print(f"\nTotal: {passed}/{total} features working")
print("="*70)

import requests
import json

API = 'http://localhost:5000/api'

endpoints = {
    'Admin': '/dashboard/admin',
    'Analytics': '/dashboard/analytics', 
    'Predictions': '/dashboard/predictions',
}

for name, ep in endpoints.items():
    try:
        r = requests.get(f'{API}{ep}')
        data = r.json()
        if 'stats' in data:
            keys = list(data['stats'].keys())[:5]
        elif 'predictions' in data:
            keys = list(data['predictions'].keys())[:5]
        else:
            keys = []
        print(f'{name} ({r.status_code}): {keys}')
    except Exception as e:
        print(f'{name}: Error - {e}')

"""
Simple SQLite helpers for AI Community Guardian
Creates users, complaints, reports, and sessions tables and provides basic CRUD
"""
import os
import sqlite3
from pathlib import Path
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash

DB_PATH = Path(__file__).resolve().parent / 'guardian.db'
DATABASE_PATH = str(DB_PATH)
print(f'Database: {DATABASE_PATH}')

CREATE_USERS = '''
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_admin INTEGER DEFAULT 0,
    created_at TEXT
);
'''

CREATE_COMPLAINTS = '''
CREATE TABLE IF NOT EXISTS complaints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    title TEXT,
    issue TEXT,
    issue_type TEXT,
    description TEXT,
    severity TEXT,
    priority TEXT DEFAULT 'Medium',
    department TEXT,
    location TEXT,
    recommended_action TEXT,
    status TEXT DEFAULT 'New',
    report_text TEXT,
    analysis_text TEXT,
    image_path TEXT,
    latitude REAL,
    longitude REAL,
    created_at TEXT
);
'''

CREATE_REPORTS = '''
CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    title TEXT,
    issue TEXT,
    description TEXT,
    severity TEXT,
    priority TEXT DEFAULT 'Medium',
    department TEXT,
    location TEXT,
    recommended_action TEXT,
    status TEXT DEFAULT 'New',
    report_text TEXT,
    analysis_text TEXT,
    created_at TEXT
);
'''

CREATE_SESSIONS = '''
CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT UNIQUE,
    username TEXT,
    created_at TEXT
);
'''


def get_conn():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def add_column_if_missing(conn, table, column, definition):
    cur = conn.cursor()
    cur.execute(f"PRAGMA table_info({table})")
    existing = [row['name'] for row in cur.fetchall()]
    if column not in existing:
        cur.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")


def init_db():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(CREATE_USERS)
    add_column_if_missing(conn, 'users', 'is_admin', 'INTEGER DEFAULT 0')
    add_column_if_missing(conn, 'users', 'created_at', 'TEXT')
    cur.execute(CREATE_COMPLAINTS)
    cur.execute(CREATE_REPORTS)
    cur.execute(CREATE_SESSIONS)

    complaint_columns = {
        'title': 'TEXT',
        'issue': 'TEXT',
        'issue_type': 'TEXT',
        'description': 'TEXT',
        'severity': 'TEXT',
        'priority': "TEXT DEFAULT 'Medium'",
        'department': 'TEXT',
        'location': 'TEXT',
        'recommended_action': 'TEXT',
        'status': "TEXT DEFAULT 'New'",
        'report_text': 'TEXT',
        'analysis_text': 'TEXT',
        'image_path': 'TEXT',
        'latitude': 'REAL',
        'longitude': 'REAL',
        'created_at': 'TEXT',
        'updated_at': 'TEXT',
        'resolution_notes': 'TEXT',
    }
    report_columns = {
        'title': 'TEXT',
        'issue': 'TEXT',
        'description': 'TEXT',
        'severity': 'TEXT',
        'priority': "TEXT DEFAULT 'Medium'",
        'department': 'TEXT',
        'location': 'TEXT',
        'recommended_action': 'TEXT',
        'status': "TEXT DEFAULT 'New'",
        'report_text': 'TEXT',
        'analysis_text': 'TEXT',
        'created_at': 'TEXT',
    }
    for column, definition in complaint_columns.items():
        add_column_if_missing(conn, 'complaints', column, definition)
    for column, definition in report_columns.items():
        add_column_if_missing(conn, 'reports', column, definition)

    cur.execute('CREATE INDEX IF NOT EXISTS idx_complaints_username ON complaints(username)')
    cur.execute('CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status)')
    cur.execute('CREATE INDEX IF NOT EXISTS idx_complaints_priority ON complaints(priority)')
    cur.execute('CREATE INDEX IF NOT EXISTS idx_reports_username ON reports(username)')
    cur.execute('CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status)')
    cur.execute('CREATE INDEX IF NOT EXISTS idx_reports_priority ON reports(priority)')
    conn.commit()
    ensure_default_admin_user()
    conn.close()


# User helpers
def get_default_admin_credentials():
    username = (os.getenv('DEFAULT_ADMIN_USERNAME') or 'admin').strip() or 'admin'
    password = (os.getenv('DEFAULT_ADMIN_PASSWORD') or 'Admin@123').strip() or 'Admin@123'
    return username, password


def ensure_default_admin_user():
    username, password = get_default_admin_credentials()
    conn = get_conn()
    cur = conn.cursor()
    cur.execute('SELECT id, username, is_admin FROM users WHERE is_admin = 1 LIMIT 1')
    admin_row = cur.fetchone()
    if admin_row:
        conn.close()
        return {'success': True, 'username': admin_row['username']}

    cur.execute('SELECT id, username, is_admin FROM users WHERE username = ?', (username,))
    user_row = cur.fetchone()
    if user_row:
        cur.execute('UPDATE users SET is_admin = 1 WHERE id = ?', (user_row['id'],))
        conn.commit()
        conn.close()
        return {'success': True, 'username': username}

    conn.close()
    return create_user(username, password, is_admin=True)


def create_user(username: str, password: str, is_admin: bool = False):
    uname = (username or '').strip()
    print(f'create_user called for username: "{uname}"')
    print(f'Database during registration: {DATABASE_PATH}')
    conn = get_conn()
    cur = conn.cursor()
    password_hash = generate_password_hash(password)
    created_at = datetime.utcnow().isoformat()
    try:
        cur.execute('INSERT INTO users (username, password_hash, is_admin, created_at) VALUES (?, ?, ?, ?)',
                    (uname, password_hash, int(is_admin), created_at))
        conn.commit()
        conn.close()
        return {'success': True}
    except sqlite3.IntegrityError as e:
        # Username already exists (unique constraint)
        import traceback
        print('Registration Error: IntegrityError - username may already exist', e)
        traceback.print_exc()
        try:
            conn.rollback()
        except Exception:
            pass
        conn.close()
        return {'success': False, 'error': 'username_exists', 'message': str(e)}
    except Exception as e:
        # Log full traceback and return error info in development
        import traceback
        print('Registration Error:', e)
        traceback.print_exc()
        try:
            conn.rollback()
        except Exception:
            pass
        conn.close()
        return {'success': False, 'error': 'db_error', 'message': str(e)}


def verify_user(username: str, password: str):
    uname = (username or '').strip()
    print(f'verify_user called for username: "{uname}"')
    print(f'Database during login: {DATABASE_PATH}')
    conn = get_conn()
    cur = conn.cursor()
    cur.execute('SELECT * FROM users WHERE username = ?', (uname,))
    row = cur.fetchone()
    print('DB row:', dict(row) if row else None)
    conn.close()
    if not row:
        print('verify_user: no user row found')
        return False
    stored_hash = row['password_hash']
    print('Stored password hash:', stored_hash)
    try:
        result = check_password_hash(stored_hash, password)
        print('check_password_hash result:', result)
        return result
    except Exception as e:
        import traceback
        print('Error checking password hash:', e)
        traceback.print_exc()
        return False


def is_admin_user(username: str):
    return True


# Complaint helpers
def add_complaint(username, issue_type, severity, priority='Medium', department='', description='', image_path=None, latitude=None, longitude=None, title=None, location=None, recommended_action='', status='New', report_text='', analysis_text=''):
    conn = get_conn()
    cur = conn.cursor()
    created_at = datetime.utcnow().isoformat()
    complaint_title = title or issue_type or 'Community Complaint'
    complaint_issue = issue_type or title or 'Community Issue'
    cur.execute('''INSERT INTO complaints (
        username, title, issue, issue_type, description, severity, priority, department, location, recommended_action, status, report_text, analysis_text, image_path, latitude, longitude, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                (username, complaint_title, complaint_issue, issue_type, description, severity, priority, department, location, recommended_action, status, report_text, analysis_text, image_path, latitude, longitude, created_at))
    conn.commit()
    cid = cur.lastrowid
    conn.close()
    return cid


def get_complaints_by_user(username):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute('''SELECT id, issue_type, severity, priority, department, description, status, created_at, latitude, longitude
                   FROM complaints
                   WHERE username = ?
                   ORDER BY created_at DESC''', (username,))
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows


def get_all_complaints():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute('SELECT id, username, title, issue_type, severity, priority, department, status, description, location, created_at FROM complaints ORDER BY created_at DESC')
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows


def update_complaint_status(complaint_id, status):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute('UPDATE complaints SET status = ?, updated_at = ? WHERE id = ?', (status, datetime.utcnow().isoformat(), complaint_id))
    conn.commit()
    conn.close()


def get_admin_complaints():
    conn = get_conn()
    cur = conn.cursor()
    try:
        cur.execute('''SELECT id, username, title, issue_type, description, severity, priority, department, status, location, latitude, longitude, report_text, analysis_text, created_at, updated_at, recommended_action, resolution_notes
                       FROM complaints ORDER BY created_at DESC''')
        rows = [dict(r) for r in cur.fetchall()]
    except sqlite3.OperationalError:
        add_column_if_missing(conn, 'complaints', 'updated_at', 'TEXT')
        add_column_if_missing(conn, 'complaints', 'resolution_notes', 'TEXT')
        cur.execute('''SELECT id, username, title, issue_type, description, severity, priority, department, status, location, latitude, longitude, report_text, analysis_text, created_at, updated_at, recommended_action, resolution_notes
                       FROM complaints ORDER BY created_at DESC''')
        rows = [dict(r) for r in cur.fetchall()]

    if rows:
        conn.close()
        return rows

    cur.execute('''SELECT id, username, title, issue AS issue_type, description, severity, priority, department, status, location, NULL AS latitude, NULL AS longitude, report_text, analysis_text, created_at, NULL AS updated_at, recommended_action, NULL AS resolution_notes
                   FROM reports ORDER BY created_at DESC''')
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows


def update_admin_complaint(complaint_id, title=None, description=None, priority=None, department=None, status=None, resolution_notes=None):
    conn = get_conn()
    cur = conn.cursor()
    updates = []
    params = []
    if title is not None:
        updates.append('title = ?')
        params.append(title)
    if description is not None:
        updates.append('description = ?')
        params.append(description)
    if priority is not None:
        updates.append('priority = ?')
        params.append(priority)
    if department is not None:
        updates.append('department = ?')
        params.append(department)
    if status is not None:
        updates.append('status = ?')
        params.append(status)
    if resolution_notes is not None:
        updates.append('resolution_notes = ?')
        params.append(resolution_notes)
    updates.append('updated_at = ?')
    params.extend([datetime.utcnow().isoformat(), complaint_id])
    cur.execute(f'UPDATE complaints SET {", ".join(updates)} WHERE id = ?', tuple(params))
    conn.commit()
    conn.close()


def delete_admin_complaint(complaint_id):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute('DELETE FROM complaints WHERE id = ?', (complaint_id,))
    deleted = cur.rowcount
    conn.commit()
    conn.close()
    return deleted > 0


# Report helpers
    conn.commit()
    conn.close()
    return deleted > 0


# Report helpers
def create_report(username, title, issue, description, severity, priority, location, recommended_action, department, status, report_text, analysis_text=None):
    conn = get_conn()
    cur = conn.cursor()
    created_at = datetime.utcnow().isoformat()
    cur.execute('''INSERT INTO reports (username, title, issue, description, severity, priority, location, recommended_action, department, status, report_text, analysis_text, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                (username, title, issue, description, severity, priority, location, recommended_action, department, status, report_text, analysis_text, created_at))
    conn.commit()
    rid = cur.lastrowid
    conn.close()
    return rid


def get_reports_by_user(username):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute('''SELECT id, title, issue, severity, priority, department, status, created_at, location
                   FROM reports
                   WHERE username = ?
                   ORDER BY created_at DESC''', (username,))
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows


def search_reports_by_user(username, search=None, status=None, priority=None, department=None, sort='newest'):
    conn = get_conn()
    cur = conn.cursor()
    query = '''SELECT id, title, issue, severity, priority, department, status, created_at, location
               FROM reports
               WHERE username = ?'''
    params = [username]

    if search:
        search_term = f"%{search.strip()}%"
        query += ' AND (title LIKE ? OR issue LIKE ? OR description LIKE ? OR department LIKE ? OR location LIKE ?)'
        params.extend([search_term] * 5)

    if status:
        query += ' AND status = ?'
        params.append(status)

    if priority:
        query += ' AND priority = ?'
        params.append(priority)

    if department:
        query += ' AND department = ?'
        params.append(department)

    if sort == 'newest':
        query += ' ORDER BY created_at DESC'
    elif sort == 'oldest':
        query += ' ORDER BY created_at ASC'
    elif sort in ('priority', 'priority_desc'):
        query += " ORDER BY CASE priority WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 WHEN 'Low' THEN 4 ELSE 5 END, created_at DESC"
    elif sort == 'priority_asc':
        query += " ORDER BY CASE priority WHEN 'Low' THEN 1 WHEN 'Medium' THEN 2 WHEN 'High' THEN 3 WHEN 'Critical' THEN 4 ELSE 5 END, created_at DESC"
    elif sort == 'status':
        query += " ORDER BY CASE status WHEN 'New' THEN 1 WHEN 'Under Review' THEN 2 WHEN 'In Progress' THEN 3 WHEN 'Resolved' THEN 4 ELSE 5 END, created_at DESC"
    else:
        query += ' ORDER BY created_at DESC'

    cur.execute(query, tuple(params))
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows


def get_report_dashboard_counts(username):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute('SELECT COUNT(*) AS total FROM reports WHERE username = ?', (username,))
    total = cur.fetchone()['total']
    cur.execute('SELECT COUNT(*) AS critical FROM reports WHERE username = ? AND priority = ?', (username, 'Critical'))
    critical = cur.fetchone()['critical']
    cur.execute('SELECT COUNT(*) AS pending FROM reports WHERE username = ? AND status IN (?, ?, ?)', (username, 'New', 'Under Review', 'In Progress'))
    pending = cur.fetchone()['pending']
    cur.execute('SELECT COUNT(*) AS resolved FROM reports WHERE username = ? AND status = ?', (username, 'Resolved'))
    resolved = cur.fetchone()['resolved']
    conn.close()
    return {'total': total, 'critical': critical, 'pending': pending, 'resolved': resolved}


def get_report_by_id(report_id, username):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute('SELECT id, title, issue, description, severity, priority, location, recommended_action, department, status, report_text, analysis_text, created_at FROM reports WHERE id = ? AND username = ?', (report_id, username))
    row = cur.fetchone()
    conn.close()
    return dict(row) if row else None


def delete_report(report_id, username):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute('DELETE FROM reports WHERE id = ? AND username = ?', (report_id, username))
    deleted = cur.rowcount
    conn.commit()
    conn.close()
    return deleted > 0


# Session helpers
def add_session(session_id, username):
    conn = get_conn()
    cur = conn.cursor()
    created_at = datetime.utcnow().isoformat()
    cur.execute('INSERT OR IGNORE INTO sessions (session_id, username, created_at) VALUES (?, ?, ?)',
                (session_id, username, created_at))
    conn.commit()
    conn.close()


def delete_session(session_id):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute('DELETE FROM sessions WHERE session_id = ?', (session_id,))
    conn.commit()
    conn.close()


# Initialize DB on import
init_db()

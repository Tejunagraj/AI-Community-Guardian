import base64
import json
import logging
import os
from typing import Optional

from dotenv import load_dotenv
from groq import Groq

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(BASE_DIR, '.env')
load_dotenv(ENV_PATH, override=False)

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(name)s %(message)s')

DEFAULT_MODEL = os.getenv('GROQ_MODEL', 'llama-3.3-70b-versatile')
REQUEST_TIMEOUT_SECONDS = 90
VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"

_groq_client = None


def _normalize_string(value, default=''):
    if value is None:
        return default
    try:
        return str(value).strip()
    except Exception:
        return default


def _get_model_name() -> str:
    return os.getenv('GROQ_MODEL', 'llama-3.3-70b-versatile').strip() or 'llama-3.3-70b-versatile'


def _get_groq_client() -> Groq:
    global _groq_client
    if _groq_client is not None:
        return _groq_client

    api_key = os.getenv('GROQ_API_KEY', '').strip()
    if not api_key:
        raise RuntimeError('Invalid API key')

    _groq_client = Groq(api_key=api_key, timeout=REQUEST_TIMEOUT_SECONDS)
    return _groq_client


def _friendly_error(exc: Exception) -> str:
    message = str(exc).strip()
    lowered = message.lower()
    if not message:
        return 'Internal AI error.'
    if '401' in lowered or 'invalid api key' in lowered or 'unauthorized' in lowered or 'authentication' in lowered:
        return 'Invalid API key'
    if '429' in lowered or 'rate limit' in lowered or 'temporarily busy' in lowered or 'too many requests' in lowered:
        return 'AI service temporarily busy. Please try again.'
    if '500' in lowered or '502' in lowered or '503' in lowered or 'internal' in lowered or 'server error' in lowered:
        return 'Internal AI error.'
    return 'AI service is temporarily unavailable.'


def _extract_text(response_data: dict) -> str:
    try:
        choices = response_data.get('choices') or []
        if not choices:
            return ''
        message = choices[0].get('message') or {}
        content = message.get('content')
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            parts = []
            for item in content:
                if isinstance(item, dict):
                    if isinstance(item.get('text'), str):
                        parts.append(item['text'])
                    elif isinstance(item.get('content'), str):
                        parts.append(item['content'])
                elif isinstance(item, str):
                    parts.append(item)
            return '\n'.join(parts)
        return ''
    except Exception as exc:
        logger.exception('Failed to extract text from Groq response: %s', exc)
        return ''


def _parse_json_response(response_text: str) -> dict:
    if not response_text:
        return {}

    try:
        return json.loads(response_text)
    except Exception:
        pass

    match = None
    try:
        match = json.loads(response_text[response_text.find('{'):response_text.rfind('}') + 1])
    except Exception:
        pass

    if match:
        return match

    return {}


def _request_groq(prompt: str) -> str:
    model_name = _get_model_name()
    logger.info('Groq model selected: %s', model_name)
    client = _get_groq_client()

    try:
        response = client.chat.completions.create(
            model=model_name,
            messages=[{'role': 'user', 'content': prompt}],
            temperature=0.2,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        logger.info('Groq response received for prompt length=%s', len(prompt))
        text = _extract_text({'choices': [{'message': {'content': getattr(response.choices[0].message, 'content', '')}}]})
        if not text:
            raise RuntimeError('No content returned from Groq')
        return text
    except Exception as exc:
        logger.exception('Groq request failed: %s', exc)
        raise


def _request_groq_vision(image_bytes: bytes) -> str:
    logger.info('Groq vision model selected: %s', VISION_MODEL)
    client = _get_groq_client()

    try:
        encoded = base64.b64encode(image_bytes).decode('utf-8')
        prompt = (
            'Analyze this image for civic problems. Return ONLY valid JSON. '
            '{issue_type, severity, description, recommended_actions, responsible_department, priority, estimated_response_time}. '
            'Possible issues: Garbage, Road Damage, Water Leakage, Broken Street Light, Illegal Dumping, Flooding, Blocked Drain, Pothole, Traffic Signal Damage. '
            'If no issue exists return issue_type="General Observation".'
        )
        response = client.chat.completions.create(
            model=VISION_MODEL,
            messages=[{
                'role': 'user',
                'content': [
                    {'type': 'text', 'text': prompt},
                    {'type': 'image_url', 'image_url': {'url': f'data:image/jpeg;base64,{encoded}'}}
                ],
            }],
            temperature=0.2,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        logger.info('Groq vision response received')
        text = _extract_text({'choices': [{'message': {'content': getattr(response.choices[0].message, 'content', '')}}]})
        if not text:
            raise RuntimeError('No content returned from Groq')
        return text
    except Exception as exc:
        logger.exception('Groq vision request failed: %s', exc)
        raise


def chat(message: str) -> dict:
    if not message or not str(message).strip():
        return {'success': False, 'error': 'AI service is temporarily unavailable.'}

    try:
        prompt = f'You are a helpful civic support assistant. Respond to the user request: {message}'
        text = _request_groq(prompt)
        return {'success': True, 'response': text}
    except Exception as exc:
        logger.exception('Groq chat failed: %s', exc)
        return {'success': False, 'error': _friendly_error(exc)}


def analyze_image(image_path: str) -> dict:
    if not image_path or not os.path.exists(image_path):
        logger.error('Image analysis requested for missing file: %s', image_path)
        return {'success': False, 'error': 'Unable to analyze image.'}

    try:
        with open(image_path, 'rb') as handle:
            image_bytes = handle.read()

        if not image_bytes:
            logger.error('Image file is empty: %s', image_path)
            return {'success': False, 'error': 'Unable to analyze image.'}

        response_text = _request_groq_vision(image_bytes)
        parsed = _parse_json_response(response_text)
        if parsed and isinstance(parsed, dict):
            normalized = {
                'issue_type': _normalize_string(parsed.get('issue_type'), 'General Observation'),
                'severity': _normalize_string(parsed.get('severity'), 'Medium'),
                'description': _normalize_string(parsed.get('description'), 'Visual inspection completed.'),
                'recommended_actions': _normalize_string(parsed.get('recommended_actions'), ''),
                'responsible_department': _normalize_string(parsed.get('responsible_department'), 'Municipal Corporation'),
                'priority': _normalize_string(parsed.get('priority'), 'Medium'),
                'estimated_response_time': _normalize_string(parsed.get('estimated_response_time'), 'Within 24 hours'),
            }
            if not normalized['issue_type'] or 'no issue' in normalized['issue_type'].lower() or 'general observation' in normalized['issue_type'].lower():
                normalized['issue_type'] = 'General Observation'
                normalized['severity'] = 'Low'
                normalized['description'] = normalized['description'] or 'Visual inspection completed.'
            return {'success': True, 'analysis': normalized}

        logger.error('Groq did not return valid JSON for image analysis: %s', response_text)
        return {'success': False, 'error': 'Unable to analyze image.'}
    except Exception as e:
        import traceback
        traceback.print_exc()
        print('IMAGE ANALYSIS ERROR:', str(e))
        return {
            'success': False,
            'error': str(e)
        }


def generate_report(analysis: str, location: Optional[str] = None) -> dict:
    if not analysis or not str(analysis).strip():
        return {'success': False, 'error': 'AI service is temporarily unavailable.'}

    try:
        prompt = (
            'Using the analysis below, generate a professional complaint report suitable for filing with local municipal authorities. '
            'Return ONLY valid JSON with the keys: title, issue, description, severity, location, recommended_action, department, date, status, report_text. '
            'If location is not provided, set location to "Not provided". Do not include any extra explanation outside the JSON object.\n\n'
            f'Analysis:\n{analysis}\n'
        )
        response_text = _request_groq(prompt)
        parsed = _parse_json_response(response_text)
        if parsed and isinstance(parsed, dict):
            title = _normalize_string(parsed.get('title'), 'Community Complaint Report')
            issue = _normalize_string(parsed.get('issue'), 'Community Issue')
            description = _normalize_string(parsed.get('description'), analysis)
            severity = _normalize_string(parsed.get('severity'), 'Medium')
            location_value = _normalize_string(parsed.get('location'), location or 'Not provided')
            recommended_action = _normalize_string(parsed.get('recommended_action'))
            department = _normalize_string(parsed.get('department'))
            report_text = _normalize_string(parsed.get('report_text'), response_text)
            status = _normalize_string(parsed.get('status'), 'Submitted')
            return {
                'success': True,
                'title': title,
                'issue': issue,
                'description': description,
                'severity': severity,
                'location': location_value,
                'recommended_action': recommended_action,
                'department': department,
                'status': status,
                'report_text': report_text,
                'raw_report': response_text,
            }

        return {
            'success': True,
            'title': 'Community Complaint Report',
            'issue': 'Community Issue',
            'description': analysis,
            'severity': 'Medium',
            'location': location or 'Not provided',
            'recommended_action': '',
            'department': '',
            'status': 'Submitted',
            'report_text': response_text,
            'raw_report': response_text,
        }
    except Exception as exc:
        logger.exception('Groq report generation failed: %s', exc)
        return {'success': False, 'error': _friendly_error(exc)}
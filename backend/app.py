"""
app.py
======
Flask REST API for the Exam Timetable Scheduler.

Endpoints
---------
GET  /default-data   → sample input data for the UI demo
POST /solve          → run CSP solver, return solution + visualization steps
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from csp_solver import build_and_solve

app = Flask(__name__)
CORS(app)  # Allow React dev server (port 5173) to call us (port 5000)


# ---------------------------------------------------------------------------
# Default dataset — gives the UI a realistic demo out of the box
# ---------------------------------------------------------------------------

DEFAULT_DATA = {
    "exams": [
        {"course": "Artificial Intelligence",    "teacher": "Dr. Ahmed",   "students": ["S01","S02","S03","S04","S05"]},
        {"course": "Software Engineering",       "teacher": "Dr. Khan",    "students": ["S01","S06","S07","S08","S09"]},
        {"course": "Database Systems",           "teacher": "Dr. Ali",     "students": ["S02","S06","S10","S11","S12"]},
        {"course": "Computer Networks",          "teacher": "Dr. Hassan",  "students": ["S03","S07","S10","S13","S14"]},
        {"course": "Operating Systems",          "teacher": "Dr. Ahmed",   "students": ["S04","S08","S11","S13","S15"]},
        {"course": "HCI",                        "teacher": "Dr. Raza",    "students": ["S05","S09","S12","S14","S15"]},
    ],
    "rooms": [
        {"name": "Hall-A", "capacity": 60},
        {"name": "Hall-B", "capacity": 60},
        {"name": "Lab-1",  "capacity": 30},
    ],
    "time_slots": [
        {"day": "Monday",    "period": "09:00-11:00"},
        {"day": "Monday",    "period": "12:00-14:00"},
        {"day": "Tuesday",   "period": "09:00-11:00"},
        {"day": "Tuesday",   "period": "12:00-14:00"},
        {"day": "Wednesday", "period": "09:00-11:00"},
        {"day": "Wednesday", "period": "12:00-14:00"},
    ],
    "min_gap": 0
}


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/default-data", methods=["GET"])
def get_default_data():
    """Return the sample dataset so the frontend can pre-populate its form."""
    return jsonify(DEFAULT_DATA)


@app.route("/solve", methods=["POST"])
def solve():
    """
    Accept scheduling data, run the CSP solver, return results.

    Request body (JSON):
    {
        "exams"      : [...],
        "rooms"      : [...],
        "time_slots" : [...],
        "min_gap"    : int
    }

    Response (JSON):
    {
        "solution" : { course: {slot, room, day, period} } | null,
        "steps"    : [ {kind, exam, value, detail, domains}, ... ],
        "stats"    : { assignments, backtracks, prunes }
    }
    """
    data = request.get_json()

    if not data:
        return jsonify({"error": "No JSON body provided"}), 400

    # Basic validation
    required = ["exams", "rooms", "time_slots"]
    for field in required:
        if field not in data or not data[field]:
            return jsonify({"error": f"Missing or empty field: {field}"}), 400

    try:
        result = build_and_solve(data)
        return jsonify(result)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    app.run(debug=True, port=5000)

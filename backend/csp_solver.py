"""
csp_solver.py
=============
Exam Timetable Scheduler implemented with OR-Tools CP-SAT.

This replaces the manual backtracking CSP implementation with:
    from ortools.sat.python import cp_model

Model summary:
- Decision variables: x[e, s, r] in {0,1}
  exam e is assigned to slot s and room r.
- Constraints:
  1) each exam is assigned exactly once
  2) at most one exam per (slot, room)
  3) teacher/student conflicting exams respect minimum gap
  4) room capacity feasibility
- Solving: CP-SAT fixed search with two modes:
  - optimized: exam ordering by (domain size, conflict degree)
  - plain: input order (baseline comparison)
"""

from dataclasses import dataclass
from typing import Any

from ortools.sat.python import cp_model


@dataclass
class Exam:
    course: str
    teacher: str
    students: set[str]


@dataclass
class Room:
    name: str
    capacity: int


@dataclass
class TimeSlot:
    day: str
    period: str
    index: int

    def label(self) -> str:
        return f"{self.day} {self.period}"


def _step(kind: str, exam: str, value: Any = None, detail: str = "", domains: dict | None = None) -> dict:
    item = {
        "kind": kind,
        "exam": exam,
        "value": value,
        "detail": detail,
        "domains": {},
    }
    if domains:
        item["domains"] = {k: int(v) for k, v in domains.items()}
    return item


def _status_name(status: int) -> str:
    names = {
        cp_model.OPTIMAL: "OPTIMAL",
        cp_model.FEASIBLE: "FEASIBLE",
        cp_model.INFEASIBLE: "INFEASIBLE",
        cp_model.MODEL_INVALID: "MODEL_INVALID",
        cp_model.UNKNOWN: "UNKNOWN",
    }
    return names.get(status, "UNKNOWN")


def _operation_count(stats: dict[str, Any]) -> int:
    return int(stats.get("branches", 0)) + int(stats.get("conflicts", 0)) + int(stats.get("assignments", 0))


def _has_conflict(e1: Exam, e2: Exam) -> bool:
    return e1.teacher == e2.teacher or bool(e1.students & e2.students)


class ORToolsExamScheduler:
    def __init__(
        self,
        exams: list[Exam],
        rooms: list[Room],
        time_slots: list[TimeSlot],
        min_gap: int,
        mode: str = "optimized",
        record_steps: bool = True,
        max_time_seconds: float = 10.0,
    ):
        self.exams = exams
        self.rooms = rooms
        self.slots = time_slots
        self.min_gap = max(0, min_gap)
        self.mode = mode
        self.record_steps = record_steps
        self.max_time_seconds = max_time_seconds

        self.course_to_exam = {e.course: e for e in self.exams}
        self.exam_index = {e.course: i for i, e in enumerate(self.exams)}

        # Capacity-aware feasible assignments for each exam index.
        self.feasible_by_exam: dict[int, list[tuple[int, int]]] = {}
        for ei, exam in enumerate(self.exams):
            allowed = []
            for si, _slot in enumerate(self.slots):
                for ri, room in enumerate(self.rooms):
                    if room.capacity >= len(exam.students):
                        allowed.append((si, ri))
            self.feasible_by_exam[ei] = allowed

    def _build_model(self) -> tuple[cp_model.CpModel, dict[tuple[int, int, int], cp_model.IntVar], list[cp_model.IntVar]]:
        model = cp_model.CpModel()
        vars_by_esr: dict[tuple[int, int, int], cp_model.IntVar] = {}

        # Bool variable for each feasible (exam, slot, room).
        for ei in range(len(self.exams)):
            for (si, ri) in self.feasible_by_exam[ei]:
                vars_by_esr[(ei, si, ri)] = model.NewBoolVar(f"x_e{ei}_s{si}_r{ri}")

        # Each exam must be scheduled exactly once.
        for ei in range(len(self.exams)):
            exam_vars = [vars_by_esr[(ei, si, ri)] for (si, ri) in self.feasible_by_exam[ei]]
            model.Add(sum(exam_vars) == 1)

        # At most one exam in each room-time pair.
        for si in range(len(self.slots)):
            for ri in range(len(self.rooms)):
                cell_vars = [
                    vars_by_esr[(ei, si, ri)]
                    for ei in range(len(self.exams))
                    if (ei, si, ri) in vars_by_esr
                ]
                if cell_vars:
                    model.Add(sum(cell_vars) <= 1)

        # Conflict and min-gap constraints.
        for i in range(len(self.exams)):
            for j in range(i + 1, len(self.exams)):
                e1 = self.exams[i]
                e2 = self.exams[j]
                if not _has_conflict(e1, e2):
                    continue

                for s1 in range(len(self.slots)):
                    for s2 in range(len(self.slots)):
                        if abs(s1 - s2) <= self.min_gap:
                            v1 = [vars_by_esr[(i, s1, r)] for r in range(len(self.rooms)) if (i, s1, r) in vars_by_esr]
                            v2 = [vars_by_esr[(j, s2, r)] for r in range(len(self.rooms)) if (j, s2, r) in vars_by_esr]
                            if v1 and v2:
                                model.Add(sum(v1) + sum(v2) <= 1)

        # Search order: optimized mode mimics MRV-ish ordering via domain size and degree.
        exam_order = list(range(len(self.exams)))
        if self.mode == "optimized":
            degree = {i: 0 for i in exam_order}
            for i in exam_order:
                for j in exam_order:
                    if i < j and _has_conflict(self.exams[i], self.exams[j]):
                        degree[i] += 1
                        degree[j] += 1
            exam_order.sort(key=lambda idx: (len(self.feasible_by_exam[idx]), -degree[idx]))

        decision_vars: list[cp_model.IntVar] = []
        for ei in exam_order:
            for (si, ri) in sorted(self.feasible_by_exam[ei], key=lambda x: (x[0], x[1])):
                decision_vars.append(vars_by_esr[(ei, si, ri)])

        if decision_vars:
            model.AddDecisionStrategy(
                decision_vars,
                cp_model.CHOOSE_FIRST,
                cp_model.SELECT_MAX_VALUE,
            )

        return model, vars_by_esr, decision_vars

    def _extract_solution(
        self,
        solver: cp_model.CpSolver,
        vars_by_esr: dict[tuple[int, int, int], cp_model.IntVar],
        status: int,
    ) -> dict[str, dict[str, str]] | None:
        if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            return None

        solution: dict[str, dict[str, str]] = {}
        for ei, exam in enumerate(self.exams):
            chosen = None
            for (si, ri) in self.feasible_by_exam[ei]:
                var = vars_by_esr[(ei, si, ri)]
                if solver.BooleanValue(var):
                    chosen = (si, ri)
                    break

            if chosen is None:
                return None

            si, ri = chosen
            slot = self.slots[si]
            room = self.rooms[ri]
            solution[exam.course] = {
                "slot": slot.label(),
                "room": room.name,
                "day": slot.day,
                "period": slot.period,
            }

        return solution

    def _build_steps(self, solution: dict[str, dict[str, str]] | None) -> list[dict]:
        """
        Build a visualization step sequence.

        For each exam in assignment order:
          1. 'try'    — show which slot/room is being attempted
          2. 'assign' — confirm the placement, collapse its domain to 1
          3. 'prune'  — for every conflicting unassigned exam, remove now-blocked
                        (slot, room) pairs from its feasible set and record how
                        many values were pruned (simulates forward checking).

        This gives the UI real data to drive the Algorithm Pipeline panel and the
        FC-prunes counter instead of always showing zero.
        """
        if not self.record_steps:
            return []

        if not solution:
            return [
                _step(
                    "fail",
                    "",
                    detail="No valid timetable exists for the given constraints.",
                )
            ]

        # Map each assigned course → (slot_index, room_index).
        course_to_sr: dict[str, tuple[int, int]] = {}
        for course, placement in solution.items():
            si = next(
                i for i, s in enumerate(self.slots)
                if s.day == placement["day"] and s.period == placement["period"]
            )
            ri = next(i for i, r in enumerate(self.rooms) if r.name == placement["room"])
            course_to_sr[course] = (si, ri)

        # Track remaining feasible (slot, room) sets per course — starts as a
        # copy of the capacity-filtered domains computed at construction time.
        remaining_feasible: dict[str, set[tuple[int, int]]] = {
            self.exams[ei].course: set(self.feasible_by_exam[ei])
            for ei in range(len(self.exams))
        }

        # Process exams in the order they appear in the solved timetable.
        ordered = sorted(
            solution.items(),
            key=lambda item: (
                next(
                    i for i, s in enumerate(self.slots)
                    if s.day == item[1]["day"] and s.period == item[1]["period"]
                ),
                item[0],
            ),
        )

        steps: list[dict] = []

        for course, placement in ordered:
            si, ri = course_to_sr[course]
            value = {"slot": placement["slot"], "room": placement["room"]}

            # ── TRY ──────────────────────────────────────────────────────────
            domain_snapshot = {c: len(fs) for c, fs in remaining_feasible.items()}
            steps.append(
                _step(
                    "try",
                    course,
                    value=value,
                    detail=f"Trying {course} → {placement['slot']} in {placement['room']}",
                    domains=domain_snapshot,
                )
            )

            # ── ASSIGN — collapse this exam's domain to the chosen value ─────
            remaining_feasible[course] = {(si, ri)}
            domain_snapshot = {c: len(fs) for c, fs in remaining_feasible.items()}
            steps.append(
                _step(
                    "assign",
                    course,
                    value=value,
                    detail=f"Assigned {course} → {placement['slot']} / {placement['room']}",
                    domains=domain_snapshot,
                )
            )

            # ── PRUNE — forward checking for every conflicting exam ───────────
            # Remove any (slot, room) pair whose slot falls within min_gap of the
            # just-assigned slot from the domains of conflicting unassigned exams.
            exam_obj = self.course_to_exam[course]
            for other_course, other_feasible in remaining_feasible.items():
                if other_course == course or len(other_feasible) <= 1:
                    continue  # already assigned or no pruning possible
                other_exam = self.course_to_exam[other_course]
                if not _has_conflict(exam_obj, other_exam):
                    continue

                blocked = {
                    (s2, r2)
                    for (s2, r2) in other_feasible
                    if abs(s2 - si) <= self.min_gap
                }
                if not blocked:
                    continue

                before = len(other_feasible)
                remaining_feasible[other_course] -= blocked
                pruned = before - len(remaining_feasible[other_course])

                if pruned > 0:
                    domain_snapshot = {c: len(fs) for c, fs in remaining_feasible.items()}
                    steps.append(
                        _step(
                            "prune",
                            other_course,
                            detail=(
                                f"FC: removed {pruned} option(s) from '{other_course}' "
                                f"(conflicts with '{course}')"
                            ),
                            domains=domain_snapshot,
                        )
                    )

        steps.append(_step("solution", "", detail="Valid timetable found."))
        return steps

    def solve(self) -> dict:
        # Immediate infeasibility if any exam has no feasible room-time options.
        no_domain = [
            self.exams[ei].course for ei in range(len(self.exams)) if len(self.feasible_by_exam[ei]) == 0
        ]
        if no_domain:
            steps = []
            if self.record_steps:
                steps = [
                    _step(
                        "fail",
                        "",
                        detail=(
                            "No feasible (slot, room) values for: "
                            + ", ".join(no_domain)
                            + ". Check room capacities and available slots."
                        ),
                    )
                ]
            return {
                "solution": None,
                "steps": steps,
                "status": "INFEASIBLE",
                "cutoff": False,
                "stats": {
                    "tries": 0,
                    "assignments": 0,
                    "backtracks": 0,
                    "prunes": 0,
                    "branches": 0,
                    "conflicts": 0,
                    "wall_time_ms": 0,
                },
            }

        model, vars_by_esr, _decision_vars = self._build_model()
        solver = cp_model.CpSolver()
        solver.parameters.search_branching = cp_model.FIXED_SEARCH
        solver.parameters.max_time_in_seconds = self.max_time_seconds

        status = solver.Solve(model)
        solved = status in (cp_model.OPTIMAL, cp_model.FEASIBLE)
        solution = self._extract_solution(solver, vars_by_esr, status)

        steps = self._build_steps(solution)

        # FIX: count actual prune steps produced by _build_steps instead of
        # aliasing NumBranches() (which made prunes == tries == branches).
        prune_count = sum(1 for s in steps if s.get("kind") == "prune")

        stats = {
            "tries":        int(solver.NumBranches()),
            "assignments":  len(solution) if solution else 0,
            "backtracks":   int(solver.NumConflicts()),
            "prunes":       prune_count,                        # FIX
            "branches":     int(solver.NumBranches()),
            "conflicts":    int(solver.NumConflicts()),
            "wall_time_ms": round(float(solver.WallTime()) * 1000, 2),
        }

        return {
            "solution": solution if solved else None,
            "steps": steps,
            "status": _status_name(status),
            "cutoff": status == cp_model.UNKNOWN,
            "stats": stats,
        }


def _validate_input(data: dict) -> list[str]:
    errors: list[str] = []

    exams_raw = data.get("exams")
    rooms_raw = data.get("rooms")
    slots_raw = data.get("time_slots")
    min_gap   = data.get("min_gap", 1)

    if not isinstance(exams_raw, list) or len(exams_raw) == 0:
        errors.append("Provide at least one exam entry.")
    if not isinstance(rooms_raw, list) or len(rooms_raw) == 0:
        errors.append("Provide at least one room entry.")
    if not isinstance(slots_raw, list) or len(slots_raw) == 0:
        errors.append("Provide at least one time slot entry.")

    # FIX: accept numeric floats that are whole numbers (e.g. JSON sends 1.0).
    try:
        min_gap_f = float(min_gap)
        if min_gap_f < 0 or min_gap_f != int(min_gap_f):
            errors.append("min_gap must be a non-negative integer.")
    except (TypeError, ValueError):
        errors.append("min_gap must be a non-negative integer.")

    seen_courses = set()
    max_students_in_exam = 0

    if isinstance(exams_raw, list):
        for idx, exam in enumerate(exams_raw, start=1):
            if not isinstance(exam, dict):
                errors.append(f"Exam #{idx} must be an object.")
                continue

            course   = str(exam.get("course", "")).strip()
            teacher  = str(exam.get("teacher", "")).strip()
            students = exam.get("students", [])

            if not course:
                errors.append(f"Exam #{idx} has an empty course name.")
            if not teacher:
                errors.append(f"Exam '{course or idx}' has an empty teacher name.")
            if not isinstance(students, list):
                errors.append(f"Exam '{course or idx}' students must be a list.")
                students = []

            if course:
                normalized = course.lower()
                if normalized in seen_courses:
                    errors.append(f"Duplicate course found: '{course}'.")
                else:
                    seen_courses.add(normalized)

            unique_students = {str(s).strip() for s in students if str(s).strip()}
            max_students_in_exam = max(max_students_in_exam, len(unique_students))

    room_names = set()
    max_room_capacity = 0
    if isinstance(rooms_raw, list):
        for idx, room in enumerate(rooms_raw, start=1):
            if not isinstance(room, dict):
                errors.append(f"Room #{idx} must be an object.")
                continue

            name        = str(room.get("name", "")).strip()
            capacity_raw = room.get("capacity", 0)
            try:
                capacity = int(capacity_raw)
            except (TypeError, ValueError):
                capacity = 0

            if not name:
                errors.append(f"Room #{idx} has an empty name.")
            if capacity <= 0:
                errors.append(f"Room '{name or idx}' capacity must be a positive integer.")

            if name:
                lowered = name.lower()
                if lowered in room_names:
                    errors.append(f"Duplicate room found: '{name}'.")
                else:
                    room_names.add(lowered)

            max_room_capacity = max(max_room_capacity, capacity)

    slot_names = set()
    if isinstance(slots_raw, list):
        for idx, slot in enumerate(slots_raw, start=1):
            if not isinstance(slot, dict):
                errors.append(f"Time slot #{idx} must be an object.")
                continue

            day    = str(slot.get("day",    "")).strip()
            period = str(slot.get("period", "")).strip()

            if not day or not period:
                errors.append(f"Time slot #{idx} requires non-empty day and period.")
                continue

            key = (day.lower(), period.lower())
            if key in slot_names:
                errors.append(f"Duplicate time slot found: '{day} {period}'.")
            else:
                slot_names.add(key)

    if max_students_in_exam > 0 and max_room_capacity > 0 and max_students_in_exam > max_room_capacity:
        errors.append("At least one exam has more students than the largest room capacity.")

    return errors


def _build_comparison(optimized: dict, baseline: dict) -> dict:
    optimized_ops = _operation_count(optimized.get("stats", {}))
    baseline_ops  = _operation_count(baseline.get("stats", {}))

    reduction_percent  = None
    improvement_ratio  = None
    if baseline_ops > 0 and optimized_ops > 0:
        reduction_percent = round((1 - (optimized_ops / baseline_ops)) * 100, 2)
        improvement_ratio = round(baseline_ops / optimized_ops, 2)

    return {
        "optimized": {
            "status":     "solved" if optimized.get("solution") else optimized.get("status", "UNKNOWN").lower(),
            "operations": optimized_ops,
            "stats":      optimized.get("stats", {}),
        },
        "plain_backtracking": {
            "status":     "cutoff" if baseline.get("cutoff") else (
                              "solved" if baseline.get("solution")
                              else baseline.get("status", "UNKNOWN").lower()
                          ),
            "operations": baseline_ops,
            "stats":      baseline.get("stats", {}),
            "cutoff":     bool(baseline.get("cutoff", False)),
        },
        "reduction_percent": reduction_percent,
        "improvement_ratio": improvement_ratio,
    }


def build_and_solve(data: dict) -> dict:
    errors = _validate_input(data)
    if errors:
        raise ValueError("Input validation failed: " + " | ".join(errors))

    exams: list[Exam] = []
    for exam in data["exams"]:
        students = {
            str(s).strip().upper()
            for s in exam.get("students", [])
            if str(s).strip()
        }
        exams.append(
            Exam(
                course=str(exam["course"]).strip(),
                teacher=str(exam["teacher"]).strip(),
                students=students,
            )
        )

    rooms = [
        Room(name=str(room["name"]).strip(), capacity=int(room.get("capacity", 50)))
        for room in data["rooms"]
    ]

    slots = [
        TimeSlot(day=str(slot["day"]).strip(), period=str(slot["period"]).strip(), index=i)
        for i, slot in enumerate(data["time_slots"])
    ]

    min_gap = int(float(data.get("min_gap", 1)))

    optimized = ORToolsExamScheduler(
        exams=exams,
        rooms=rooms,
        time_slots=slots,
        min_gap=min_gap,
        mode="optimized",
        record_steps=True,
        max_time_seconds=10.0,
    ).solve()

    baseline = ORToolsExamScheduler(
        exams=exams,
        rooms=rooms,
        time_slots=slots,
        min_gap=min_gap,
        mode="plain",
        record_steps=False,
        max_time_seconds=8.0,
    ).solve()

    optimized["comparison"] = _build_comparison(optimized, baseline)

    if not optimized.get("solution"):
        optimized["guidance"] = [
            "Try adding more time slots or rooms.",
            "Reduce minimum gap if your policy allows it.",
            "Increase room capacities or rebalance exam student lists.",
        ]

    return optimized
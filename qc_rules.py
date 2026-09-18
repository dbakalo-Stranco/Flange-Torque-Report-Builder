"""Company QC standards -- bolt size / torque by flange size+class.

These are Daniel Bakalo's standing rules: given a flange size/class, the
bolt OD and torque range are known and should be checked against (and can
override) whatever the tag says, flagging a mismatch rather than silently
trusting a miswritten tag.
"""

DEFAULT_QC = [
    {"size": '3"', "cls": 150, "boltOD": "5/8",
     "tMin": 45, "tMax": 45, "boltCount": 4, "ratios": [0.33, 0.67, 1, 1]},
    {"size": '4"', "cls": 150, "boltOD": "5/8",
     "tMin": 45, "tMax": 45, "boltCount": 4, "ratios": [0.33, 0.67, 1, 1]},
    {"size": '6"', "cls": 150, "boltOD": "3/4",
     "tMin": 45, "tMax": 45, "boltCount": 8, "ratios": [0.33, 0.67, 1, 1]},
    {"size": '20"', "cls": 150, "boltOD": "1 1/8",
     "tMin": 200, "tMax": 230, "boltCount": 20, "ratios": [0.244, 0.511, 0.756, 1]},
]


def find_rule(qc_rules, size, cls):
    def norm(s):
        return str(s).replace('"', "").replace(" ", "").strip().lower()
    for r in qc_rules:
        if norm(r["size"]) == norm(size) and str(r["cls"]).strip() == str(cls).strip():
            return r
    return None


# Known tool certs on file: serial -> capacity/row on the "Tools Required"
# grid + its latest calibration date. Row numbers match the fixed rows on
# the report template: 32 TORQUE PUMP, 33 250LB CLICKER, 34 600LB CLICKER,
# 35 W2000, 36 W4000, 37 W8000, 38 S3000, 39 80LB CLICKER/B-RAD JGUN
# (whichever that sheet's row 39 is preprinted as), 40 open/custom row.
# Add to this list (via the Tools panel in the app, which is editable and
# remembered per-browser same as the QC table) as new tool certs come in.
DEFAULT_TOOLS = [
    {"serial": "DTB14971", "model": "Proto 6008C", "capacity": 80, "row": 39, "cal": "9/2/2026"},
    {"serial": "DXC53245", "model": "Proto 6008C", "capacity": 80, "row": 39, "cal": "9/2/2026"},
    {"serial": "DEC10920", "model": "Proto 6008C", "capacity": 80, "row": 39, "cal": "9/9/2026"},
    {"serial": "DTF45365", "model": "Proto 6008C", "capacity": 80, "row": 39, "cal": "6/3/2026"},
    {"serial": "DSJ51800", "model": "Proto 6014C", "capacity": 250, "row": 33, "cal": "6/3/2026"},
    {"serial": "0721901819", "model": "CDI2503MFRMH", "capacity": 250, "row": 33, "cal": "6/2/2026"},
    {"serial": "2503011125", "model": "URREA 60143", "capacity": 250, "row": 33, "cal": "9/9/2026"},
    {"serial": "DXB51107", "model": "Proto 6014", "capacity": 250, "row": 33, "cal": "8/10/2026"},
    {"serial": "BL12387", "model": "B-RAD Select BL", "capacity": 1000, "row": 39, "cal": "3/3/2026"},
    {"serial": "BL22762", "model": "B-RAD Select BL", "capacity": 1000, "row": 39, "cal": "8/27/2026"},
]


def find_tool(tools, serial):
    if not serial:
        return None
    norm = str(serial).strip().upper().replace(" ", "")
    for t in tools:
        if str(t["serial"]).strip().upper().replace(" ", "") == norm:
            return t
    return None

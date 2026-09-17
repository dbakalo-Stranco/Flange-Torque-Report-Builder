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

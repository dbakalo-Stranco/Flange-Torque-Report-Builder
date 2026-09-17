"""
Reads Stranco field torque tags from a photo using the Anthropic API and
returns structured JSON. Uses tool-choice forcing so the response is
guaranteed to be valid, schema-shaped JSON rather than free text to parse.
"""
import base64
import os

import anthropic

MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-5")

TAG_SCHEMA = {
    "type": "object",
    "properties": {
        "tags": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "tag": {"type": "string", "description": "Tag # printed on the card, e.g. STR 39918 (digits only is fine)"},
                    "drawing": {"type": "string", "description": "Drawing # field, exactly as written"},
                    "line": {"type": "string", "description": "Any line/unit code embedded in the 'F' # field or drawing field (e.g. CDU224, FWU208). Empty string if none."},
                    "flangeNo": {"type": "string", "description": "The flange number itself, stripped of any line code"},
                    "toolSerial": {"type": "string"},
                    "boltMaterial": {"type": "string"},
                    "boltSize": {"type": "string", "description": "e.g. 5/8, 3/4, 1 1/8"},
                    "flangeSize": {"type": "string", "description": "e.g. 4\", 6\", 20\""},
                    "flangeClass": {"type": "string", "description": "e.g. 150"},
                    "finalTorque": {"type": "string"},
                    "gasket": {"type": "string"},
                    "lubricantUsed": {"type": "string", "enum": ["Yes", "No", ""]},
                    "lubricantType": {"type": "string"},
                    "insulKit": {"type": "string", "enum": ["Yes", "No", ""]},
                    "tamperSeal": {"type": "string", "enum": ["Yes", "No", ""]},
                    "technician": {"type": "string"},
                    "technicianDate": {"type": "string"},
                    "inspector": {"type": "string"},
                    "inspectorDate": {"type": "string"},
                    "uncertain": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Field names you were not confident about (illegible, obscured, cut off, contradictory marks, etc). Be honest and flag generously -- never guess silently on a field you can't clearly read.",
                    },
                },
                "required": ["tag", "drawing", "flangeNo", "boltSize", "flangeSize", "flangeClass", "finalTorque", "uncertain"],
            },
        }
    },
    "required": ["tags"],
}

EXTRACT_PROMPT = """You are reading one or more Stranco "Remove when QC Approved" field torque tag cards from a photo. Each card is a small torque-record tag filled out by hand for a single flange. A single photo may show several tags at once (laid out in a grid) -- read every tag you can see and return one entry per tag.

Each card has these printed fields, filled in by hand: Tag #, Drawing #, "F" # (flange number -- this field sometimes also has a line/unit code like CDU224 or FWU208 embedded in it, sometimes the line code is written in the Drawing # field instead), Tool Serial #, Bolt Material Spec/Grade, Bolt Size, Flange Size/Class, Final Torque (FT-LB), Gasket Type, Lubricant Used (Yes/No circled), Type of Lubricant, Insul. Kit Installed (Yes/No circled), Kit Manufacturer, Tamper Seal Applied (Yes/No circled), Technician + Date, Joint Approved (Yes/No circled), Inspector + Date.

Read the handwriting carefully -- these are field-filled cards, often messy, sometimes overlapping or photographed at an angle. For the "line" field: if you see a unit/line code like CDU### or FWU### anywhere in the Drawing # or F# field, extract it separately into "line" and put ONLY the flange's own number into "flangeNo". If no such code is present, leave "line" empty and put the drawing's own number in "drawing" as written.

Be honest about uncertainty. If a field is illegible, obscured by a correction mark, cut off, or ambiguous (e.g. an unclear Yes/No circle), still give your best reading but list that field's name in "uncertain" for that tag so a human can double check it. Never silently guess on something you can't actually read.

Return your answer using the record_tags tool."""


def _media_type_for(filename: str, provided: str | None) -> str:
    if provided and provided.startswith("image/"):
        return provided
    lower = filename.lower()
    if lower.endswith(".png"):
        return "image/png"
    if lower.endswith(".webp"):
        return "image/webp"
    if lower.endswith(".gif"):
        return "image/gif"
    return "image/jpeg"


def extract_tags_from_image(image_bytes: bytes, filename: str = "tag.jpg",
                             content_type: str | None = None) -> list[dict]:
    client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from env
    media_type = _media_type_for(filename, content_type)
    b64 = base64.standard_b64encode(image_bytes).decode("ascii")

    resp = client.messages.create(
        model=MODEL,
        max_tokens=4096,
        tools=[{
            "name": "record_tags",
            "description": "Records the structured data read from one or more torque tag cards in this photo.",
            "input_schema": TAG_SCHEMA,
        }],
        tool_choice={"type": "tool", "name": "record_tags"},
        messages=[{
            "role": "user",
            "content": [
                {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}},
                {"type": "text", "text": EXTRACT_PROMPT},
            ],
        }],
    )

    for block in resp.content:
        if block.type == "tool_use" and block.name == "record_tags":
            tags = block.input.get("tags", [])
            for t in tags:
                t["_source"] = filename
            return tags
    return []

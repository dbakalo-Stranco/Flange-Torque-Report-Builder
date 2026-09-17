import io
import os
import tempfile
import traceback

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles

from extract import extract_tags_from_image
from qc_rules import DEFAULT_QC
from report_builder import build_workbook, workbook_to_bytes, xlsx_bytes_to_pdf_bytes

app = FastAPI(title="Flange Torque Report Builder")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

STATIC_DIR = os.path.join(os.path.dirname(__file__), "..", "static")

PDF_MAX_PAGES = 6


def _pdf_to_images(data: bytes):
    from pdf2image import convert_from_bytes
    pages = convert_from_bytes(data, dpi=200)
    out = []
    for i, page in enumerate(pages[:PDF_MAX_PAGES]):
        buf = io.BytesIO()
        page.convert("RGB").save(buf, format="JPEG", quality=90)
        out.append(buf.getvalue())
    return out


@app.get("/api/qc-defaults")
def qc_defaults():
    return {"qc": DEFAULT_QC}


@app.post("/api/extract")
async def extract(files: list[UploadFile] = File(...)):
    all_tags = []
    errors = []
    for f in files:
        data = await f.read()
        try:
            if (f.content_type == "application/pdf") or f.filename.lower().endswith(".pdf"):
                images = _pdf_to_images(data)
                for idx, img_bytes in enumerate(images):
                    label = f.filename if len(images) == 1 else f"{f.filename} (p.{idx+1})"
                    tags = extract_tags_from_image(img_bytes, filename=label, content_type="image/jpeg")
                    all_tags.extend(tags)
            else:
                tags = extract_tags_from_image(data, filename=f.filename, content_type=f.content_type)
                all_tags.extend(tags)
        except Exception as e:
            traceback.print_exc()
            errors.append({"file": f.filename, "error": str(e)})
    return {"tags": all_tags, "errors": errors}


@app.post("/api/generate")
async def generate(payload: dict):
    entries = payload.get("entries")
    fmt = payload.get("format", "pdf")
    if not entries:
        raise HTTPException(status_code=400, detail="No entries provided")
    try:
        wb = build_workbook(entries)
        xlsx_bytes = workbook_to_bytes(wb)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=f"Could not build workbook: {e}")

    if fmt == "xlsx":
        return StreamingResponse(
            io.BytesIO(xlsx_bytes),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=Flange_Torque_Report.xlsx"},
        )

    try:
        pdf_bytes = xlsx_bytes_to_pdf_bytes(xlsx_bytes)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"PDF conversion failed: {e}")

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=Flange_Torque_Report.pdf"},
    )


@app.get("/health")
def health():
    return {"ok": True}


app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")

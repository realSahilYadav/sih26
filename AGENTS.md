This project is a rural healthcare access platform for SIH 2026 (PS133, Govt of Maharashtra).
Stack: Python + FastAPI backend, PostgreSQL via Supabase, React frontend (three separate
portals: user/, doctor/, admin/), PostGIS for geo queries.
Architecture principle: this system is an INTEGRATION layer, not a replacement for existing
government health infrastructure. Always prefer wiring into ABDM (ABHA ID, HIE-CM, HFR/HPR),
eSanjeevani (teleconsultation), and Bhashini/ULCA (multilingual ASR/TTS) over building
equivalent functionality from scratch. Store only data that is genuinely local to this
solution: appointments, triage results, referral status, and local medicine stock — linked
to patients by their ABHA ID, not a custom patient ID.
Use clear RBAC: roles are patient, doctor, admin, and health_worker.
Write type-hinted Python, use Pydantic models for all API schemas, and keep endpoints RESTful.
Prioritize working end-to-end slices over polished individual pieces early on.
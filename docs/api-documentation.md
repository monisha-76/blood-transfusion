# JeevanSetu API Specification

## Authentication Endpoints (`/api/auth`)
- `POST /api/auth/register`: Register user with role (`PATIENT`, `DOCTOR`, `DONOR`, etc.).
- `POST /api/auth/login`: Authenticate and receive JWT token.
- `GET /api/auth/me`: Get active user profile and linked role entity.

## Patient Endpoints (`/api/patients`)
- `POST /api/patients`: Create or update patient medical profile & transfusion frequency.
- `GET /api/patients/me`: Get patient profile, active blood request status, and transfusion history.
- `GET /api/patients`: Get all patients (Doctor / Admin / Hospital Mgmt).

## Doctor Endpoints (`/api/doctors`)
- `GET /api/doctors/patients`: Get assigned patient roster.
- `GET /api/doctors/approvals`: Get blood requests pending doctor approval.
- `POST /api/doctors/approve-transfusion`: Approve or decline blood request for clinical transfusion.
- `POST /api/doctors/complete-transfusion`: Complete transfusion & auto-recalculate next predicted date.

## Donor Endpoints (`/api/donors`)
- `GET /api/donors/me`: Get donor profile and availability status.
- `PUT /api/donors/me`: Update donor availability or profile details.
- `GET /api/donors/requests`: Get pending donation requests matching donor.
- `POST /api/donors/respond`: Accept or reject a blood donation request.
- `POST /api/donors/public-register`: [PUBLIC] Public guest donor registration intake form.

## Blood Bank Endpoints (`/api/blood-bank`)
- `GET /api/blood-bank/inventory`: Get blood inventory stock units.
- `POST /api/blood-bank/inventory`: Add new blood inventory batch.
- `PUT /api/blood-bank/inventory/:id`: Modify stock quantity or status.
- `POST /api/blood-bank/inventory/purge-expired`: Mark expired blood units.

## Blood Request & Procurement (`/api/blood-requests`)
- `GET /api/blood-requests`: List all blood requests.
- `POST /api/blood-requests`: Create blood request & trigger procurement search.
- `POST /api/blood-requests/:id/search`: Re-trigger 4-level search pipeline.
- `GET /api/blood-requests/escalated`: Get 7-day escalated cases.

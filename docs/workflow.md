# JeevanSetu Pre-Transfusion Blood Procurement Workflow

## 10-Day Pre-Transfusion Step-by-Step Logic

```
T - 10 Days
    ↓
Automated Cron Detection -> Create Blood Request
    ↓
LEVEL 1: Check Hospital Blood Bank Inventory
    ├── IF Sufficient Non-Expired Stock Available:
    │     ├── Reserve Required Stock Units
    │     ├── Update Status -> BLOOD_AVAILABLE / RESERVED
    │     └── Notify Doctor, Patient, Hospital Management
    │
    └── IF Stock Unavailable / Insufficient:
          ↓
LEVEL 2: Search Registered Donor Database
    ├── Query Compatible Blood Groups (Matrix)
    ├── Filter Eligible Donors (Active, >= 90 days interval)
    ├── Notify Matching Donors (In-App & Email)
    │     ├── IF Donor Accepts -> Provisionally Fulfilled -> Notify Doctor/Hospital
    │     └── IF Donor Rejects/Timeout -> Continue Searching Next Matching Donors
    │
    └── IF No Registered Donors Accept:
          ↓
LEVEL 3: Public Donor Recruitment & Social Campaign
    ├── Launch Social Media Campaign (Mock/Dev Provider Mode)
    ├── Public Guest Donor Registration Intake Page (/public-donor-register)
    └── Store New Donors & Re-scan Active Procurement Requests
          ↓
LEVEL 4: Day 7 Escalation (T - 3 Days)
    ├── IF Required Blood Still Unavailable After 7 Search Days:
    │     ├── Transition Status -> UNAVAILABLE_ESCALATED
    │     ├── Send Urgent Escalation Alert to HOSPITAL_MANAGEMENT
    │     └── Request Remains Active & Monitorable (DO NOT DELETE/CLOSE)
    │
    └── CONTINUOUS MONITORING FOR LATE AVAILABILITY:
          └── When New Stock Added or Donor Accepts -> Auto-Detect -> Transition to BLOOD_AVAILABLE -> Notify Stakeholders
```

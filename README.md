# JeevanSetu – Automated Blood Transfusion & Donor Coordination System

JeevanSetu is a full-stack, web-based automated blood transfusion management and donor coordination platform specifically designed for **thalassemia patients** requiring regular, life-saving blood transfusions.

The platform connects 6 distinct stakeholders:
1. **Patient**: View transfusion schedules, procurement status, and history.
2. **Doctor**: Review patient roster, grant clinical transfusion approvals, and complete procedures.
3. **Blood Bank**: Manage inventory stock, reserve units, and purge expired blood batches.
4. **Donor**: Respond to donation requests and toggle availability status.
5. **Hospital Management**: Monitor procurement alerts, manage Day 7 escalations, and oversee social campaigns.
6. **Admin**: Oversee user management, platform RBAC, and system health metrics.

---

## 🌟 Key Business Features

### Automated 10-Day Pre-Transfusion Procurement Workflow
- **Transfusion Date Prediction**: Auto-predicts next transfusion date based on patient frequency (e.g. every 21 days).
- **Automated T-10 Trigger**: Starts blood search 10 days before scheduled transfusion date.
- **Priority Level 1 (Blood Bank Stock)**: Checks inventory stock first. If available, reserves units and notifies doctor, patient, and hospital management.
- **Priority Level 2 (Registered Donors)**: If stock is unavailable, queries compatible donors using a blood group compatibility matrix and minimum 90-day donation interval rules.
- **Priority Level 3 (Public Campaign & Guest Intake)**: Launches public recruitment campaigns if registered donors decline or are unavailable. Accepts guest donor registrations via a public intake form (`/public-donor-register`).
- **Priority Level 4 (Day 7 Escalation)**: If blood remains unfulfilled after 7 days of active search (T-3 days before transfusion), sends an urgent escalation notification to Hospital Management while keeping the request open and monitorable.
- **Late Availability Auto-Detection**: Automatically detects late stock additions or donor acceptances post-escalation and transitions status to `BLOOD_AVAILABLE`.

---

## 🛠️ Technology Stack

- **Backend**: Node.js, Express.js, JavaScript, Mongoose, JWT, bcryptjs, Nodemailer, node-cron.
- **Frontend**: React 18, Vite, JavaScript, Tailwind CSS, React Router v6, Axios, React Toastify, Recharts, Lucide-React.
- **Database**: MongoDB / MongoDB Atlas.
- **Testing**: Jest, Supertest.

---

## 📂 Project Structure

```
final yearproject/
├── backend/
│   ├── config/ (db.js)
│   ├── controllers/ (authController, patientController, doctorController, donorController, bloodBankController, bloodRequestController, transfusionController, notificationController, adminController)
│   ├── middleware/ (authMiddleware, roleMiddleware, errorMiddleware)
│   ├── models/ (User, Patient, Doctor, Donor, BloodInventory, BloodRequest, Transfusion, Notification, SocialCampaign)
│   ├── routes/ (authRoutes, patientRoutes, doctorRoutes, donorRoutes, bloodBankRoutes, bloodRequestRoutes, transfusionRoutes, notificationRoutes, adminRoutes)
│   ├── services/ (bloodSearchService, bloodMatchingService, transfusionScheduler, notificationService, socialMediaService)
│   ├── jobs/ (bloodSearchJob.js)
│   ├── utils/ (jwt.js, email.js, dateUtils.js)
│   ├── scripts/ (seed.js)
│   ├── tests/ (app.test.js)
│   ├── app.js
│   ├── server.js
│   ├── .env.example
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/ (Navbar, Sidebar, StatCard, StatusBadge, NotificationBell, Modal)
│   │   ├── context/ (AuthContext)
│   │   ├── services/ (api.js, authService, bloodService, patientService, donorService)
│   │   ├── pages/ (Landing, Login, Register, PublicDonorRegister, PatientDashboard, DoctorDashboard, BloodBankDashboard, DonorDashboard, HospitalMgmtDashboard, AdminDashboard)
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
│
├── docs/
│   ├── system-architecture.md
│   ├── api-documentation.md
│   ├── database-design.md
│   └── workflow.md
└── README.md
```

---

## ⚙️ Environment Setup

### 1. Backend `.env` Configuration (`backend/.env`)
```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/jeevansetu
JWT_SECRET=jeevansetu_super_secret_jwt_key_2026_change_in_production
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
EMAIL_HOST=smtp.ethereal.email
EMAIL_PORT=587
EMAIL_USER=ethereal_user_demo
EMAIL_PASSWORD=ethereal_pass_demo
EMAIL_FROM="JeevanSetu Health System" <notifications@jeevansetu.org>
SOCIAL_MEDIA_MODE=mock
```

### 2. Frontend `.env` Configuration (`frontend/.env`)
```env
VITE_API_URL=http://localhost:5000/api
```

---

## 🚀 Running the Project

### Step 1: Install Dependencies & Seed Database
```bash
# In backend directory
cd backend
npm install
npm run seed

# In frontend directory
cd ../frontend
npm install
```

### Step 2: Start Backend Server
```bash
cd backend
npm run dev
# Server starts on http://localhost:5000
```

### Step 3: Start Frontend Client
```bash
cd frontend
npm run dev
# App starts on http://localhost:5173
```

---

## 🔑 Test Credentials (Seeded Accounts)

All seeded test accounts use password: `password123`

| Role | Email | Features / Dashboard |
| :--- | :--- | :--- |
| **Admin** | `admin@jeevansetu.org` | Full user control, system metrics & RBAC |
| **Hospital Mgmt** | `hospital@jeevansetu.org` | Escalation tracker, 7-day alerts, campaigns |
| **Doctor** | `doctor@jeevansetu.org` | Transfusion approvals & patient roster |
| **Patient** | `patient@jeevansetu.org` | T-10 countdown, procurement tracker, history |
| **Blood Bank** | `bloodbank@jeevansetu.org` | Stock inventory control & Recharts stock breakdown |
| **Donor** | `donor@jeevansetu.org` | Active requests accept/reject & availability toggle |

---

## 🧪 Running Automated Tests

To execute the backend unit and integration test suite:

```bash
cd backend
npm test
```

---

## 📡 Social Media Abstraction
When `SOCIAL_MEDIA_MODE=mock` is set, the application operates in safe development mode. Real social media APIs require production credentials; JeevanSetu generates mock campaign links without claiming false production posts.

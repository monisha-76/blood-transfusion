# JeevanSetu Database Schema Design

## Data Models & Schema Indexing

### 1. User Schema (`User`)
- `email`: String (Unique, Indexed)
- `password`: String (Hashed with bcrypt)
- `role`: Enum (`ADMIN`, `PATIENT`, `DOCTOR`, `BLOOD_BANK`, `DONOR`, `HOSPITAL_MANAGEMENT`)

### 2. Patient Schema (`Patient`)
- `userId`: ObjectId (Ref: User)
- `bloodGroup`: Enum (`A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`, `O+`, `O-`, Indexed)
- `transfusionFrequency`: Number (Default 21 days)
- `lastTransfusionDate`: Date
- `nextTransfusionDate`: Date (Indexed for cron search)
- `assignedDoctor`: ObjectId (Ref: User)

### 3. Donor Schema (`Donor`)
- `userId`: ObjectId (Ref: User, Optional for guest public donors)
- `bloodGroup`: Enum (Indexed)
- `availabilityStatus`: Enum (`AVAILABLE`, `UNAVAILABLE`, Indexed)
- `verificationStatus`: Enum (`PENDING_VERIFICATION`, `ELIGIBLE`, `INELIGIBLE`, `ACTIVE`, `INACTIVE`, Indexed)
- `lastDonationDate`: Date (Used for 90-day interval calculation)

### 4. BloodInventory Schema (`BloodInventory`)
- `bloodGroup`: Enum (Indexed)
- `quantity`: Number (Validated >= 0)
- `reservedQuantity`: Number (Validated >= 0)
- `expiryDate`: Date (Indexed)
- `status`: Enum (`AVAILABLE`, `RESERVED`, `EXPIRED`, Indexed)

### 5. BloodRequest Schema (`BloodRequest`)
- `patient`: ObjectId (Ref: Patient)
- `requiredBloodGroup`: Enum (Indexed)
- `transfusionDate`: Date (Indexed)
- `currentStatus`: Enum (`PENDING`, `INVENTORY_CHECK`, `DONOR_SEARCH`, `DONOR_NOTIFICATION`, `PUBLIC_RECRUITMENT`, `BLOOD_AVAILABLE`, `RESERVED`, `DOCTOR_APPROVAL`, `READY_FOR_TRANSFUSION`, `COMPLETED`, `UNAVAILABLE_ESCALATED`, `CANCELLED`, Indexed)
- `donorResponses`: Array of `{ donorId, status, notifiedAt, respondedAt }`

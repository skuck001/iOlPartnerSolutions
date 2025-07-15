
# iOL Partner Solutions Tracker – Project Brief

## 🧠 Overview

This web app supports the **iOL Partner Solutions team**, managing relationships with travel technology companies (e.g., PMS, CRS, GDS, Channel Managers, Tech Switches). The platform helps track **Accounts, Contacts, Products, Opportunities, and Tasks** in a clean, visual interface.

## ⚙️ Tech Stack

- **Frontend**: React (Vite + TypeScript)
- **Styling**: TailwindCSS
- **Backend**: Firebase (Firestore, Auth, Functions)
- **Auth**: Firebase Auth (Username and Password)
- **State Management**: Context API or Zustand (optional)

---

## 📁 Directory Structure

```
src/
├── pages/
│   ├── Dashboard.tsx
│   ├── Accounts.tsx
│   ├── Contacts.tsx
│   ├── Opportunities.tsx
│   └── Tasks.tsx
├── components/
│   ├── ListView.tsx
│   ├── DetailsPanel.tsx
│   ├── FormModal.tsx
│   └── TaskBoard.tsx
├── types/
│   ├── Account.ts
│   ├── Contact.ts
│   ├── Product.ts
│   ├── Opportunity.ts
│   └── Task.ts
```

---

## 🗂️ Data Models

### 🔹 `Account`
```ts
{
  id: string;
  name: string;
  industry: 'PMS' | 'CRS' | 'ChannelManager' | 'GDS' | 'Connectivity' | 'Other';
  region: string;
  website?: string;
  parentAccountId?: string;
  notes?: string;
  createdAt: Timestamp;
}
```

### 🔸 `Product`
```ts
{
  id: string;
  name: string;
  accountId: string;
  description?: string;
  contactIds: string[];
  tags: string[];
}
```

### 🔹 `Contact`
```ts
{
  id: string;
  name: string;
  email: string;
  phone?: string;
  position?: string;
  accountId: string;
  productId?: string;
  notes?: string;
}
```

### 🔸 `Opportunity`
```ts
{
  id: string;
  title: string;
  summary: string;
  accountId: string;
  productId?: string;
  contactsInvolved: string[];
  stage: 'Discovery' | 'Proposal' | 'Negotiation' | 'Closed-Won' | 'Closed-Lost';
  arrImpact: number;
  region: string;
  useCase: string;
  notes: string;
  meetingHistory: {
    date: Timestamp;
    location?: string;
    summary: string;
  }[];
  tasks: string[];
  createdAt: Timestamp;
}
```

### 🔸 `Task`
```ts
{
  id: string;
  title: string;
  opportunityId?: string;
  assignedTo: string;
  dueDate: Timestamp;
  status: 'To do' | 'In progress' | 'Done';
  bucket?: string;
}
```

---

## ✅ Feature Requirements

### 🏢 Accounts
- View company profiles
- Group by industry and region
- Support parent/child company hierarchy

### 🧩 Products
- Linked to accounts
- Optional contact assignment
- Taggable for categorization

### 👥 Contacts
- Linked to both account and optionally product
- Taggable and searchable

### 💼 Opportunities
- View by pipeline stage
- Linked to accounts, contacts, and tasks
- Store meeting summaries
- Add technical or legal notes
- Highlight key next steps

### ✅ Tasks
- Associated with opportunities or general items
- Assign to users
- Status, due date, and filter views
- Bucket tagging (e.g., Legal, Technical, etc.)
- Kanban or smart list UI (like screenshot)

---

## 🔐 Access & Roles

- Auth via Firebase User and Password for now


---

## 🎨 UI Expectations

- **List View + Detail/Edit View** for each section
- Sticky headers and clean data tables
- Colorful tags, ARR indicators, and quick filters
- Add notes, files, and tasks in one place

---

## 🔜 Phase 1 Milestones

1. Firebase project setup (Firestore, Auth, Functions)
2. Authentication with Userbname and Password
3. Implement base pages: Accounts, Contacts, Opportunities, Tasks
4. Firestore collection setup with seed data
5. Build shared components: ListView, DetailsPanel, FormModal
6. Integrate full task tracking (list & kanban view)
7. Deploy to Firebase Hosting

---
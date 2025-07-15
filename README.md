# iOL Partner Solutions Tracker

A modern web application for managing travel technology partner relationships, tracking accounts, contacts, opportunities, and tasks.

## Features

- **Dashboard** - Overview of key metrics and top opportunities
- **Accounts** - Manage partner companies (PMS, CRS, GDS, Channel Managers, etc.)
- **Contacts** - Track individual contacts at partner companies
- **Opportunities** - Manage sales pipeline and opportunities
- **Tasks** - Kanban-style task management with drag-and-drop

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: TailwindCSS
- **Backend**: Firebase (Firestore, Auth)
- **Routing**: React Router v6
- **Icons**: Lucide React
- **Date Handling**: date-fns

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Firebase project with Firestore and Authentication enabled

### Installation

1. Clone the repository and install dependencies:
```bash
npm install
```

2. The Firebase configuration is already set up with the provided credentials in `.env`.

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:5173`

### Authentication

- Create a new account using email/password on the login page
- The app uses Firebase Authentication for secure login

### Sample Data

To add sample data for testing:

1. Log in to the application
2. Open the browser console
3. Import and run the seed function:
```javascript
import { seedDatabase } from './src/lib/seedData';
seedDatabase();
```

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── Layout.tsx      # Main app layout with sidebar
│   ├── ListView.tsx    # Generic table component
│   ├── DetailsPanel.tsx # Slide-out details panel
│   ├── FormModal.tsx   # Modal for forms
│   └── TaskBoard.tsx   # Kanban board component
├── pages/              # Page components
│   ├── Dashboard.tsx   # Main dashboard
│   ├── Accounts.tsx    # Accounts management
│   ├── Contacts.tsx    # Contacts management
│   ├── Opportunities.tsx # Opportunities pipeline
│   ├── Tasks.tsx       # Task management
│   └── Login.tsx       # Authentication page
├── types/              # TypeScript type definitions
├── lib/                # Utilities and Firebase config
├── hooks/              # React hooks (auth, etc.)
└── App.tsx             # Main app component with routing
```

## Usage

### Managing Accounts
- Add partner companies with industry classification
- Track websites, regions, and notes
- Support for parent/child company relationships

### Managing Contacts
- Link contacts to specific accounts
- Store email, phone, position information
- Easy contact lookup and management

### Tracking Opportunities
- Pipeline management with stages (Discovery → Proposal → Negotiation → Closed)
- ARR impact tracking
- Regional and use case categorization
- Meeting history and notes

### Task Management
- Create tasks linked to opportunities or as general items
- Assign to team members with due dates
- Kanban board view with drag-and-drop status updates
- Categorize with buckets (Legal, Technical, Sales, etc.)

## Firebase Setup

The app is configured to use the provided Firebase project. The collections used are:

- `accounts` - Partner company information
- `contacts` - Individual contact records
- `opportunities` - Sales opportunities and pipeline
- `tasks` - Task management and tracking

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Customization

The app uses TailwindCSS for styling with a purple color scheme matching the design. The main colors are:

- Primary: Blue variants for buttons and accents
- Purple: Sidebar and branding elements
- Gray: Text and neutral elements

## Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## License

This project is proprietary to iOL Partners.

import { Timestamp } from 'firebase/firestore';
import { createDocument } from './firestore';
import { clearUsersCache } from './userUtils';

export const sampleAccounts = [
  {
    name: 'HotelTech Solutions',
    industry: 'PMS',
    region: 'North America',
    website: 'https://hoteltech.com',
    notes: 'Leading PMS provider for luxury hotels'
  },
  {
    name: 'TravelConnect',
    industry: 'GDS',
    region: 'Europe',
    website: 'https://travelconnect.eu',
    notes: 'Major GDS provider in European market'
  },
  {
    name: 'ChannelMax',
    industry: 'ChannelManager',
    region: 'Asia Pacific',
    website: 'https://channelmax.com',
    notes: 'Fast-growing channel management company'
  }
];

export const sampleOpportunities = [
  {
    title: 'AI Predictive Analytics Dashboard',
    summary: 'Advanced analytics capabilities for better forecasting and demand management',
    stage: 'Discovery',
    arrImpact: 912,
    region: 'North America',
    useCase: 'Predictive Analytics',
    notes: 'Strong interest from enterprise clients',
    contactsInvolved: [],
    meetingHistory: [],
    tasks: []
  },
  {
    title: 'Flexible Pricing Tiers',
    summary: 'More flexible pricing options to accommodate diverse customer needs',
    stage: 'Proposal',
    arrImpact: 608,
    region: 'Europe',
    useCase: 'Pricing Flexibility',
    notes: 'Mid-market segment showing strong demand',
    contactsInvolved: [],
    meetingHistory: [],
    tasks: []
  }
];

export const sampleTasks = [
  {
    title: 'Research competitor pricing models',
    assignedTo: 'Product Team',
    dueDate: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)), // 7 days from now
    status: 'To do',
    bucket: 'Research'
  },
  {
    title: 'Draft technical requirements document',
    assignedTo: 'Engineering',
    dueDate: Timestamp.fromDate(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)), // 14 days from now
    status: 'In progress',
    bucket: 'Technical'
  },
  {
    title: 'Schedule customer interviews',
    assignedTo: 'Sales Team',
    dueDate: Timestamp.fromDate(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)), // 3 days from now
    status: 'Done',
    bucket: 'Customer Research'
  }
];

export const sampleUsers = [
  {
    id: 'user1',
    email: 'john.doe@iol.world',
    displayName: 'John Doe',
    firstName: 'John',
    lastName: 'Doe',
    jobTitle: 'Sales Manager',
    department: 'Sales',
    location: 'New York',
    role: 'user',
    permissions: [],
    timezone: 'America/New_York',
    notifications: {
      email: true,
      push: true,
      weekly: true,
    },
    createdAt: Timestamp.now(),
    lastLoginAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  },
  {
    id: 'user2',
    email: 'jane.smith@iol.world',
    displayName: 'Jane Smith',
    firstName: 'Jane',
    lastName: 'Smith',
    jobTitle: 'Product Manager',
    department: 'Product',
    location: 'San Francisco',
    role: 'user',
    permissions: [],
    timezone: 'America/Los_Angeles',
    notifications: {
      email: true,
      push: false,
      weekly: true,
    },
    createdAt: Timestamp.now(),
    lastLoginAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  },
  {
    id: 'user3',
    email: 'mike.johnson@iol.world',
    displayName: 'Mike Johnson',
    firstName: 'Mike',
    lastName: 'Johnson',
    jobTitle: 'Engineering Lead',
    department: 'Engineering',
    location: 'Austin',
    role: 'admin',
    permissions: ['admin'],
    timezone: 'America/Chicago',
    notifications: {
      email: true,
      push: true,
      weekly: false,
    },
    createdAt: Timestamp.now(),
    lastLoginAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  },
  {
    id: 'user4',
    email: 'sarah.wilson@iol.world',
    displayName: 'Sarah Wilson',
    firstName: 'Sarah',
    lastName: 'Wilson',
    jobTitle: 'Customer Success Manager',
    department: 'Customer Success',
    location: 'London',
    role: 'user',
    permissions: [],
    timezone: 'Europe/London',
    notifications: {
      email: true,
      push: true,
      weekly: true,
    },
    createdAt: Timestamp.now(),
    lastLoginAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  }
];

// Utility function to seed just users for testing
export const seedUsers = async () => {
  try {
    console.log('Seeding users...');
    for (const user of sampleUsers) {
      try {
        await createDocument('users', user, user.id);
        console.log(`Created user: ${user.displayName} (${user.email})`);
      } catch (error) {
        console.warn(`User ${user.email} might already exist:`, error);
      }
    }
    
    // Clear users cache to force fresh fetch
    clearUsersCache();
    console.log('Users seeded successfully and cache cleared!');
  } catch (error) {
    console.error('Error seeding users:', error);
  }
};

export const seedDatabase = async () => {
  try {
    console.log('Seeding database with sample data...');
    
    // Create users first
    console.log('Creating sample users...');
    for (const user of sampleUsers) {
      try {
        await createDocument('users', user, user.id);
        console.log(`Created user: ${user.displayName} (${user.email})`);
      } catch (error) {
        console.warn(`User ${user.email} might already exist:`, error);
      }
    }
    
    // Clear users cache to force fresh fetch
    clearUsersCache();
    console.log('Cleared users cache');
    
    // Create accounts
    const accountIds = [];
    for (const account of sampleAccounts) {
      const id = await createDocument('accounts', account);
      accountIds.push(id);
      console.log(`Created account: ${account.name}`);
    }

    // Create opportunities linked to accounts
    for (let i = 0; i < sampleOpportunities.length; i++) {
      const opportunity = {
        ...sampleOpportunities[i],
        accountId: accountIds[i % accountIds.length]
      };
      await createDocument('opportunities', opportunity);
      console.log(`Created opportunity: ${opportunity.title}`);
    }

    // Create tasks
    for (const task of sampleTasks) {
      await createDocument('tasks', task);
      console.log(`Created task: ${task.title}`);
    }

    console.log('Database seeded successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
  }
}; 
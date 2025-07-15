import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { Contact, Account } from '../types';
import { ListView } from '../components/ListView';
import { getDocuments } from '../lib/firestore';

export const Contacts: React.FC = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [contactsData, accountsData] = await Promise.all([
        getDocuments('contacts'),
        getDocuments('accounts')
      ]);
      setContacts(contactsData as Contact[]);
      setAccounts(accountsData as Account[]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAccountName = (accountId: string) => {
    const account = accounts.find(a => a.id === accountId);
    return account?.name || 'Unknown';
  };

  const handleRowClick = (contact: Contact) => {
    // Navigate to contact details page instead of opening modal
    window.location.href = `/contacts/${contact.id}`;
  };

  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    getAccountName(contact.accountId).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns = [
    { key: 'name' as keyof Contact, label: 'Name' },
    { key: 'email' as keyof Contact, label: 'Email' },
    { key: 'position' as keyof Contact, label: 'Position' },
    { 
      key: 'accountId' as keyof Contact, 
      label: 'Company',
      render: (accountId: string) => getAccountName(accountId)
    },
  ];

  return (
    <div className="h-full flex flex-col">
      <ListView
        title="Contacts"
        data={filteredContacts}
        columns={columns}
        onRowClick={handleRowClick}
        onAdd={() => window.location.href = '/contacts/new'}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        loading={loading}
      />
    </div>
  );
}; 
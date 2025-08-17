import React, { useState, useEffect } from 'react';
import { Container, Table, Button, Modal, Form, Alert, InputGroup } from 'react-bootstrap';
import { collection, getDocs, doc, updateDoc, getDoc, addDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { sanitizeInput } from '../../utils/security';

function UserManagement() {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [currentUserEmail, setCurrentUserEmail] = useState('');
  const [walletAmount, setWalletAmount] = useState(0);
  const [currentBalance, setCurrentBalance] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [gameName, setGameName] = useState('');
  const [position, setPosition] = useState('');

  // Fetch users on component mount
  useEffect(() => {
    fetchUsers();
  }, []);
  
  // Filter users when search query changes
  useEffect(() => {
    if (users.length > 0) {
      filterUsers();
    }
  }, [searchQuery, users]);

  async function fetchUsers() {
    try {
      setLoading(true);
      const usersCollection = collection(db, 'users');
      const usersSnapshot = await getDocs(usersCollection);
      const usersList = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(usersList);
      setFilteredUsers(usersList);
    } catch (error) {
      setError('Failed to fetch users: ' + error.message);
    } finally {
      setLoading(false);
    }
  }
  
  function filterUsers() {
    const query = sanitizeInput(searchQuery.toLowerCase().trim());
    if (!query) {
      setFilteredUsers(users);
      return;
    }
    
    const filtered = users.filter(user => {
      // Search by email
      if (user.email && user.email.toLowerCase().includes(query)) {
        return true;
      }
      // Search by role
      if (user.role && user.role.toLowerCase().includes(query)) {
        return true;
      }
      // Search by wallet balance (as string)
      const walletStr = String(user.walletBalance || 0);
      if (walletStr.includes(query)) {
        return true;
      }
      return false;
    });
    
    setFilteredUsers(filtered);
  }
  
  function handleSearchChange(e) {
    setSearchQuery(e.target.value);
  }

  async function openWalletModal(userId) {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setCurrentUserId(userId);
        setCurrentBalance(userData.walletBalance || 0);
        setWalletAmount(0);
        setGameName('');
        setPosition('');
        setShowModal(true);
      } else {
        setError('User not found');
      }
    } catch (error) {
      setError('Failed to fetch user data: ' + error.message);
    }
  }

  async function handleAddFunds() {
    if (!currentUserId || walletAmount <= 0) return;

    try {
      const userRef = doc(db, 'users', currentUserId);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const newBalance = (userData.walletBalance || 0) + Number(walletAmount);
        
        // Update user's wallet balance
        await updateDoc(userRef, {
          walletBalance: newBalance,
          lastUpdated: new Date().toISOString()
        });
        
        // Create description based on game name and position
        let description = 'Reward added by administrator';
        if (gameName) {
          description = `Reward for ${gameName}`;
          if (position) {
            description += ` - ${position} position`;
          }
        }
        
        // Add record to rewards collection for history tracking
        await addDoc(collection(db, 'rewards'), {
          userId: currentUserId,
          userEmail: userData.email,
          amount: Number(walletAmount),
          description: description,
          gameName: gameName || null,
          position: position || null,
          addedBy: 'Administrator',
          timestamp: serverTimestamp(),
          previousBalance: userData.walletBalance || 0,
          newBalance: newBalance
        });
        
        // Refresh users list and reset form fields
        fetchUsers();
        setShowModal(false);
        setGameName('');
        setPosition('');
      }
    } catch (error) {
      setError('Failed to update wallet: ' + error.message);
    }
  }

  function openDeleteModal(userId, userEmail) {
    setCurrentUserId(userId);
    setCurrentUserEmail(userEmail);
    setShowDeleteModal(true);
  }

  async function handleDeleteUser() {
    if (!currentUserId) return;

    try {
      // Delete the user document from Firestore
      await deleteDoc(doc(db, 'users', currentUserId));
      
      // Refresh users list and close modal
      fetchUsers();
      setShowDeleteModal(false);
      setError('');
    } catch (error) {
      setError('Failed to delete user: ' + error.message);
    }
  }

  return (
    <Container className="py-5">
      <h1 className="mb-4">User Management</h1>
      
      {error && <Alert variant="danger">{error}</Alert>}
      
      <Form className="mb-4">
        <InputGroup>
          <Form.Control
            placeholder="Search by email, role, or wallet balance"
            value={searchQuery}
            onChange={handleSearchChange}
            aria-label="Search users"
          />
          {searchQuery && (
            <Button 
              variant="outline-secondary" 
              onClick={() => setSearchQuery('')}
            >
              Clear
            </Button>
          )}
        </InputGroup>
      </Form>
      
      {loading ? (
        <p>Loading users...</p>
      ) : (
        <Table striped bordered hover responsive>
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
              <th>Wallet Balance</th>
              <th>Joined Tournaments</th>
              <th>Created At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center">
                  {searchQuery ? 'No users match your search' : 'No users found'}
                </td>
              </tr>
            ) : (
              filteredUsers.map(user => (
                <tr key={user.id}>
                  <td>{user.email}</td>
                  <td>{user.role || 'user'}</td>
                  <td>Rs. {user.walletBalance || 0}</td>
                  <td>{user.joinedTournaments?.length || 0}</td>
                  <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                  <td>
                    <Button 
                      variant="success" 
                      size="sm"
                      onClick={() => openWalletModal(user.id)}
                      className="me-2"
                    >
                      Add Rewards
                    </Button>
                    <Button 
                      variant="danger" 
                      size="sm"
                      onClick={() => openDeleteModal(user.id, user.email)}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      )}
      
      {/* Add Funds Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Add Funds to Wallet (Rewards)</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Current Balance</Form.Label>
              <Form.Control 
                type="text" 
                value={`Rs. ${currentBalance}`} 
                disabled 
              />
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Game Name</Form.Label>
              <Form.Control 
                type="text" 
                value={gameName} 
                onChange={(e) => setGameName(e.target.value)} 
                placeholder="Enter game name (optional)" 
              />
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Position</Form.Label>
              <Form.Select
                value={position}
                onChange={(e) => setPosition(e.target.value)}
              >
                <option value="">Select position (optional)</option>
                <option value="1st">1st Position</option>
                <option value="2nd">2nd Position</option>
                <option value="3rd">3rd Position</option>
              </Form.Select>
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Reward Amount to Add (Rs.)</Form.Label>
              <Form.Control 
                type="number" 
                value={walletAmount} 
                onChange={(e) => setWalletAmount(Number(e.target.value))} 
                min="1" 
                required 
              />
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>New Balance</Form.Label>
              <Form.Control 
                type="text" 
                value={`Rs. ${currentBalance + Number(walletAmount)}`} 
                disabled 
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={handleAddFunds}
            disabled={walletAmount <= 0}
          >
            Add Rewards
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Delete User Confirmation Modal */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Delete User Account</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="danger">
            <p>Are you sure you want to delete the user account: <strong>{currentUserEmail}</strong>?</p>
            <p>This action cannot be undone and will permanently remove the user&apos;s account and all associated data.</p>
          </Alert>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
            Cancel
          </Button>
          <Button 
            variant="danger" 
            onClick={handleDeleteUser}
          >
            Delete User
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}

export default UserManagement;

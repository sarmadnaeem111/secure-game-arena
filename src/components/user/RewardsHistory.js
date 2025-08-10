import React, { useState, useEffect } from 'react';
import { Container, Card, Table, Alert, Button, Spinner } from 'react-bootstrap';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import { Link } from 'react-router-dom';

function RewardsHistory() {
  const [rewardsHistory, setRewardsHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortField, setSortField] = useState('timestamp');
  const [sortDirection, setSortDirection] = useState('desc');
  const { currentUser } = useAuth();

  useEffect(() => {
    if (currentUser) {
      fetchRewardsHistory();
    }
  }, [currentUser, sortField, sortDirection]);

  async function fetchRewardsHistory() {
    try {
      setLoading(true);
      
      // Create a reference to the rewards collection
      const rewardsRef = collection(db, 'rewards');
      
      // Query rewards for the current user
      let rewardsQuery;
      try {
        // Try with the composite index first
        rewardsQuery = query(
          rewardsRef,
          where('userId', '==', currentUser.uid),
          orderBy(sortField, sortDirection)
        );
        
        const querySnapshot = await getDocs(rewardsQuery);
        const history = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        setRewardsHistory(history);
      } catch (indexError) {
        // If composite index error occurs, fall back to a simpler query without orderBy
        console.log('Index error, falling back to simpler query:', indexError);
        
        // Fallback query without orderBy
        const fallbackQuery = query(
          rewardsRef,
          where('userId', '==', currentUser.uid)
        );
        
        const fallbackSnapshot = await getDocs(fallbackQuery);
        let fallbackHistory = fallbackSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // Sort the results in memory instead
        fallbackHistory.sort((a, b) => {
          if (sortDirection === 'asc') {
            return a[sortField] > b[sortField] ? 1 : -1;
          } else {
            return a[sortField] < b[sortField] ? 1 : -1;
          }
        });
        
        setRewardsHistory(fallbackHistory);
      }
    } catch (error) {
      // Check if it's an index error
      if (error.message && error.message.includes('index')) {
        setError('The rewards history requires a database index. Administrators can create it in the Firebase console.');
      } else {
        setError('Failed to load rewards history: ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleSort(field) {
    if (field === sortField) {
      // Toggle direction if same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Default to descending for new field
      setSortField(field);
      setSortDirection('desc');
    }
  }

  function renderSortIndicator(field) {
    if (field !== sortField) return null;
    return sortDirection === 'asc' ? ' ↑' : ' ↓';
  }

  return (
    <Container className="py-3 px-3 px-md-4">
      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center py-2 px-3">
          <h5 className="mb-0 fs-5">Rewards History</h5>
          <Link to="/profile">
            <Button variant="outline-primary" size="sm" className="px-2 py-1">Back to Profile</Button>
          </Link>
        </Card.Header>
        <Card.Body className="p-2 p-md-3">
          {error && <Alert variant="danger" className="p-2 small">{error}</Alert>}
          
          {error && error.includes('index') && (
            <Alert variant="info" className="mt-2 p-2 small">
              <p><strong>Admin Note:</strong> This feature requires a Firestore index. Please visit the Firebase console to create it.</p>
              <p className="mt-2 small text-muted" style={{fontSize: '0.8rem'}}>The application will continue to function with limited sorting capabilities until the index is created.</p>
            </Alert>
          )}
          
          {loading ? (
            <div className="text-center py-3">
              <Spinner animation="border" role="status" size="sm">
                <span className="visually-hidden">Loading...</span>
              </Spinner>
              <p className="mt-2 small">Loading rewards history...</p>
            </div>
          ) : rewardsHistory.length > 0 ? (
            <div className="table-responsive">
              <Table striped bordered hover size="sm" className="small">
                <thead>
                  <tr>
                    <th onClick={() => handleSort('timestamp')} style={{ cursor: 'pointer' }}>
                      Date {renderSortIndicator('timestamp')}
                    </th>
                    <th onClick={() => handleSort('amount')} style={{ cursor: 'pointer' }}>
                      Amount {renderSortIndicator('amount')}
                    </th>
                    <th>Description</th>
                    <th>Game</th>
                    <th>Position</th>
                    <th>Added By</th>
                  </tr>
                </thead>
                <tbody>
                  {rewardsHistory.map(reward => (
                    <tr key={reward.id}>
                      <td>{new Date(reward.timestamp).toLocaleDateString()} {new Date(reward.timestamp).toLocaleTimeString()}</td>
                      <td>Rs. {reward.amount}</td>
                      <td>{reward.description || 'Reward added to your account'}</td>
                      <td>{reward.gameName || '-'}</td>
                      <td>{reward.position || '-'}</td>
                      <td>{reward.addedBy || 'Administrator'}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          ) : (
            <Alert variant="info" className="p-2 small">
              You haven&apos;t received any rewards yet. Rewards are added by administrators for various activities or promotions.
            </Alert>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
}

export default RewardsHistory;
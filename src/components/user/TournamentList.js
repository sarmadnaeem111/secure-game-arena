import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Badge, Button, Alert, Modal, Form, Nav, Spinner } from 'react-bootstrap';
import { collection, getDocs, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import TournamentStatusService from '../../services/TournamentStatusService';
import { useNavigate } from 'react-router-dom';
import DOMPurify from 'dompurify';
import './Tournaments.css';

function TournamentList() {
  const [tournaments, setTournaments] = useState([]);
  const [filteredTournaments, setFilteredTournaments] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [currentTournament, setCurrentTournament] = useState(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const { currentUser, getUserData } = useAuth();
  const navigate = useNavigate();

  // Fetch tournaments and user data on component mount
  useEffect(() => {
    // Migrate any existing live tournaments to have statusUpdatedAt field
    TournamentStatusService.migrateLiveTournaments()
      .then(result => {
        if (result.migratedCount > 0) {
          console.log(`Migrated ${result.migratedCount} live tournaments`);
        }
      })
      .catch(error => {
        console.error('Error migrating live tournaments:', error);
      })
      .finally(() => {
        // Fetch tournaments after migration attempt
        fetchTournaments();
      });
    
    if (currentUser) {
      fetchUserWalletBalance();
    }
  }, [currentUser]);

  async function fetchTournaments() {
    try {
      setLoading(true);
      
      // Check and update tournament statuses before fetching
      await TournamentStatusService.checkAndUpdateTournamentStatuses();
      
      const tournamentsCollection = collection(db, 'tournaments');
      const tournamentsSnapshot = await getDocs(tournamentsCollection);
      const tournamentsList = tournamentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Check if current user has joined this tournament
        hasJoined: currentUser ? 
          doc.data().participants?.some(p => p.userId === currentUser.uid) : 
          false
      }));
      
      // Sort tournaments: upcoming first, then live, then completed
      tournamentsList.sort((a, b) => {
        const statusOrder = { 'upcoming': 0, 'live': 1, 'completed': 2 };
        return statusOrder[a.status] - statusOrder[b.status];
      });
      
      setTournaments(tournamentsList);
      filterTournaments(tournamentsList, activeCategory);
    } catch (error) {
      setError('Failed to fetch tournaments: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  function filterTournaments(tournamentsList, category) {
    if (category === 'all') {
      setFilteredTournaments(tournamentsList);
    } else {
      setFilteredTournaments(tournamentsList.filter(tournament => tournament.status === category));
    }
  }

  function handleCategoryChange(category) {
    setActiveCategory(category);
    filterTournaments(tournaments, category);
  }

  async function fetchUserWalletBalance() {
    try {
      const userData = await getUserData(currentUser.uid);
      if (userData) {
        setWalletBalance(userData.walletBalance || 0);
      }
    } catch (error) {
      console.error('Error fetching wallet balance:', error);
    }
  }

  function openJoinModal(tournament) {
    setCurrentTournament(tournament);
    setUsername('');
    setUsernameError('');
    setShowJoinModal(true);
  }

  async function handleJoinTournament() {
    if (!currentUser || !currentTournament || isJoining) return;

    try {
      // Set joining state to true to prevent multiple clicks
      setIsJoining(true);
      
      // Validate username
      if (!username.trim()) {
        setUsernameError('Username is required');
        setIsJoining(false);
        return;
      }
      
      // Sanitize username input
      const sanitizedUsername = DOMPurify.sanitize(username.trim());
      
      // Validate username length and characters
      if (sanitizedUsername.length < 3 || sanitizedUsername.length > 20) {
        setUsernameError('Username must be between 3 and 20 characters');
        setIsJoining(false);
        return;
      }
      
      if (!/^[a-zA-Z0-9_]+$/.test(sanitizedUsername)) {
        setUsernameError('Username can only contain letters, numbers, and underscores');
        setIsJoining(false);
        return;
      }

      // Check if username is already taken in this tournament
      if (currentTournament.participants && currentTournament.participants.some(p => 
          p.username && p.username.toLowerCase() === sanitizedUsername.toLowerCase())) {
        setUsernameError('This username is already taken in this tournament. Please choose a different one.');
        setIsJoining(false);
        return;
      }

      // Check if user has enough balance
      if (walletBalance < currentTournament.entryFee) {
        setError('Insufficient wallet balance');
        setIsJoining(false);
        return;
      }

      // Check if tournament is full
      if (currentTournament.participants?.length >= currentTournament.maxParticipants) {
        setError('Tournament is full');
        setIsJoining(false);
        return;
      }

      // Update user's wallet balance
      const userRef = doc(db, 'users', currentUser.uid);
      const newBalance = walletBalance - currentTournament.entryFee;
      
      await updateDoc(userRef, {
        walletBalance: newBalance,
        joinedTournaments: arrayUnion(currentTournament.id)
      });

      // Add user to tournament participants
      const tournamentRef = doc(db, 'tournaments', currentTournament.id);
      await updateDoc(tournamentRef, {
        participants: arrayUnion({
          userId: currentUser.uid,
          email: currentUser.email,
          username: sanitizedUsername,
          joinedAt: new Date().toISOString()
        })
      });

      // Update local state
      setWalletBalance(newBalance);
      fetchTournaments();
      setShowJoinModal(false);
    } catch (error) {
      setError('Failed to join tournament: ' + error.message);
    } finally {
      // Reset joining state regardless of success or failure
      setIsJoining(false);
    }
  }

  function getStatusBadgeVariant(status) {
    switch (status) {
      case 'upcoming': return 'primary';
      case 'live': return 'success';
      case 'completed': return 'secondary';
      default: return 'primary';
    }
  }

  return (
    <Container className="py-4 px-3 px-md-4">
      <div className="tournaments-header">
        <h1>Tournaments</h1>
        <div className="whatsapp-announcement">
          Join on Whatsapp Channel for announcements: <a href="https://whatsapp.com/channel/0029VbBMC8f1t90YcV2HDY2t" target="_blank" rel="noopener noreferrer">https://whatsapp.com/channel/0029VbBMC8f1t90YcV2HDY2t</a>
        </div>
        {currentUser && (
          <div className="text-start text-md-end wallet-balance">
            Wallet Balance: <span className="balance-amount">Rs. {walletBalance}</span>
          </div>
        )}
      </div>
      
      {error && <Alert variant="danger" className="p-2 small" onClose={() => setError('')} dismissible>{error}</Alert>}
      
      {/* Tournament Categories Mini Navbar */}
      <Nav className="tournament-categories-nav mb-4" variant="pills">
        <Nav.Item>
          <Nav.Link 
            className={activeCategory === 'all' ? 'active' : ''}
            onClick={() => handleCategoryChange('all')}
          >
            All
          </Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link 
            className={activeCategory === 'upcoming' ? 'active' : ''}
            onClick={() => handleCategoryChange('upcoming')}
          >
            Upcoming
          </Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link 
            className={activeCategory === 'live' ? 'active' : ''}
            onClick={() => handleCategoryChange('live')}
          >
            Live
          </Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link 
            className={activeCategory === 'completed' ? 'active' : ''}
            onClick={() => handleCategoryChange('completed')}
          >
            Completed
          </Nav.Link>
        </Nav.Item>
      </Nav>
      
      {loading ? (
        <p className="small">Loading tournaments...</p>
      ) : (
        <Row>
          {filteredTournaments.length === 0 ? (
            <Col>
              <Alert variant="info" className="p-2 small">No tournaments available in this category.</Alert>
            </Col>
          ) : (
            filteredTournaments.map(tournament => (
              <Col key={tournament.id} xs={12} sm={6} lg={4} className="mb-4 gy-2">
                <Card className="tournament-card h-100">
                  <Card.Header className="d-flex flex-wrap justify-content-between align-items-center">
                    <Badge bg={getStatusBadgeVariant(tournament.status)} className="tournament-status mb-1 mb-sm-0">
                      {tournament.status.toUpperCase()}
                    </Badge>
                    <span className="tournament-type">{tournament.gameType}</span>
                  </Card.Header>
                  <Card.Body>
                    {tournament.gameLogo && (
                      <div className="text-center mb-3">
                        <img 
                          src={tournament.gameLogo} 
                          alt="Game Logo" 
                          style={{ maxHeight: '80px', maxWidth: '100%', objectFit: 'contain' }} 
                          className="game-logo-img"
                        />
                      </div>
                    )}
                    <Card.Title>{tournament.gameName}</Card.Title>
                    <Card.Text>
                      <strong>Date & Time:</strong> {tournament.tournamentDate?.toDate 
                        ? tournament.tournamentDate.toDate().toLocaleDateString() 
                        : 'N/A'} {tournament.tournamentTime ? new Date(`2000-01-01T${tournament.tournamentTime}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true }) : ''}
                      <br />
                      <strong>Entry Fee:</strong> Rs. {tournament.entryFee}
                      <br />
                      <strong>Prize Pool:</strong> Rs. {tournament.prizePool}
                      <br />
                      <strong>Participants:</strong> {tournament.participants?.length || 0} / {tournament.maxParticipants}
                      {tournament.perKillAmount > 0 && (
                        <>
                          <br />
                          <strong>Per Kill:</strong> Rs. {tournament.perKillAmount}
                        </>
                      )}
                      {tournament.map && (
                        <>
                          <br />
                          <strong>Map:</strong> {tournament.map}
                        </>
                      )}
                      {tournament.version && (
                        <>
                          <br />
                          <strong>Version:</strong> {tournament.version}
                        </>
                      )}
                    </Card.Text>
                    
                    {tournament.status === 'live' && tournament.matchDetails && (
                      <div className="match-details-alert">
                        <div className="match-details-content">
                          <strong>Match Details:</strong><br />
                          {tournament.matchDetails}
                        </div>
                      </div>
                    )}
                    
                    {tournament.status === 'upcoming' && tournament.hasJoined && tournament.matchDetails && (
                      <div className="match-details-alert info">
                        <div className="match-details-content">
                          <strong>Match Details:</strong><br />
                          {tournament.matchDetails}
                        </div>
                      </div>
                    )}
                    
                    <div className="tournament-actions">
                      {currentUser ? (
                        tournament.hasJoined ? (
                          <Button variant="outline-success" className="w-100" disabled>
                            Already Joined
                          </Button>
                        ) : (
                          <Button 
                            variant="primary"
                            className="w-100"
                            disabled={tournament.status !== 'upcoming' || tournament.participants?.length >= tournament.maxParticipants}
                            onClick={() => openJoinModal(tournament)}
                          >
                            Join Tournament
                          </Button>
                        )
                      ) : (
                        <Button variant="primary" className="w-100" disabled>
                          Login to Join
                        </Button>
                      )}
                      
                      <Button 
                        variant="outline-info"
                        className="w-100"
                        onClick={() => navigate(`/tournaments/${tournament.id}`)}
                      >
                        View Details
                      </Button>
                    </div>
                  </Card.Body>
                  <Card.Footer className={`py-2 px-3 small ${tournament.status === 'live' ? 'bg-success text-white' : tournament.status === 'completed' ? 'bg-secondary text-white' : ''}`}>
                    {tournament.status === 'upcoming' ? 'Registration open' : tournament.status === 'live' ? 'Tournament in progress' : 'Tournament ended'}
                  </Card.Footer>
                </Card>
              </Col>
            ))
          )}
        </Row>
      )}
      
      {/* Join Tournament Modal */}
      <Modal show={showJoinModal} onHide={() => setShowJoinModal(false)} centered className="join-tournament-modal responsive-modal">
        <Modal.Header closeButton className="py-2 px-3">
          <Modal.Title className="fs-5">Join Tournament</Modal.Title>
        </Modal.Header>
        <Modal.Body className="px-3 py-3">
          {currentTournament && (
            <Form>
              <p className="fw-bold mb-2 small">{currentTournament.gameName}</p>
              <p className="mb-3 small">Are you sure you want to join this tournament?</p>
              
              <Form.Group className="mb-3">
                <Form.Label className="small">Entry Fee</Form.Label>
                <Form.Control 
                  type="text" 
                  value={`Rs. ${currentTournament.entryFee}`} 
                  disabled 
                  className="form-control-sm"
                />
              </Form.Group>
              
              <Form.Group className="mb-3">
                <Form.Label className="small">Your Wallet Balance</Form.Label>
                <Form.Control 
                  type="text" 
                  value={`Rs. ${walletBalance}`} 
                  disabled 
                  className="form-control-sm"
                />
              </Form.Group>
              
              <Form.Group className="mb-3">
                <Form.Label className="small">Balance After Joining</Form.Label>
                <Form.Control 
                  type="text" 
                  value={`Rs. ${walletBalance - currentTournament.entryFee}`} 
                  disabled 
                  className="form-control-sm"
                />
              </Form.Group>
              
              <Form.Group className="mb-3">
                <Form.Label className="small">Game UserName <span className="text-danger">*</span></Form.Label>
                <Form.Control 
                  type="text" 
                  placeholder="Enter your correct in-game username" 
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setUsernameError('');
                  }}
                  isInvalid={!!usernameError}
                  required
                  className="form-control-sm"
                />
                <Form.Control.Feedback type="invalid">
                  {usernameError}
                </Form.Control.Feedback>
                <Form.Text className="text-muted" style={{fontSize: '0.75rem'}}>
                  This is the username that will be used to identify you in the tournament.
                </Form.Text>
              </Form.Group>
              
              {walletBalance < currentTournament.entryFee && (
                <Alert variant="danger" className="p-2 small">
                  Insufficient balance. Please add funds to your wallet.
                </Alert>
              )}
            </Form>
          )}
        </Modal.Body>
        <Modal.Footer className="px-3 py-2 d-flex justify-content-between">
          <Button variant="secondary" onClick={() => setShowJoinModal(false)} size="sm" className="px-3">
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={handleJoinTournament}
            disabled={!currentTournament || walletBalance < currentTournament.entryFee || isJoining}
            size="sm"
            className="px-3"
          >
            {isJoining ? (
              <>
                <Spinner
                  as="span"
                  animation="border"
                  size="sm"
                  role="status"
                  aria-hidden="true"
                  className="me-1"
                />
                Joining...
              </>
            ) : (
              'Confirm & Join'
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}

export default TournamentList;

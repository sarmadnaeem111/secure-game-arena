import React, { Suspense, useEffect, useState } from 'react';
import { Container, Row, Col, Card, Button, Carousel, Alert } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';

// Import placeholder image
import heroPlaceholder from '../../assets/hero-background-optimized.jpg';

// Import gaming styles
import './HomePage.css';


function HomePage() {
  const { currentUser } = useAuth();
  const [heroLoaded, setHeroLoaded] = useState(false);
  const [featuredTournaments, setFeaturedTournaments] = useState([]);
  const [loadingFeatured, setLoadingFeatured] = useState(true);
  const [error, setError] = useState('');
  
  // Preload the hero background image and fetch featured tournaments
  useEffect(() => {
    // Preload hero image
    const img = new Image();
    img.src = require('../../assets/hero-background-optimized.jpg');
    img.onload = () => {
      // Once the image is loaded, update the CSS variable
      document.documentElement.style.setProperty(
        '--hero-background', 
        `url(${img.src})`
      );
      setHeroLoaded(true);
    };
    
    // Fetch featured tournaments
    fetchFeaturedTournaments();
  }, []);
  
  async function fetchFeaturedTournaments() {
    try {
      setLoadingFeatured(true);
      setError('');
      
      // Get featured tournaments from adminSettings collection
      const featuredDoc = doc(db, 'adminSettings', 'featuredTournaments');
      const featuredSnapshot = await getDoc(featuredDoc);
      
      if (featuredSnapshot.exists()) {
        const featuredData = featuredSnapshot.data();
        // Sort by displayOrder
        const sortedFeatured = featuredData.tournaments.sort((a, b) => a.displayOrder - b.displayOrder);
        setFeaturedTournaments(sortedFeatured);
      } else {
        setFeaturedTournaments([]);
      }
    } catch (error) {
      console.error('Error fetching featured tournaments:', error);
      setError('Failed to load featured tournaments');
    } finally {
      setLoadingFeatured(false);
    }
  }

  return (
    <div>
      {/* Hero Section */}
      <div className="gaming-hero">
        <Container>
          <Row className="align-items-center">
            <Col xs={12} md={6} className="mb-4 mb-md-0">
              <h1 className="gaming-title display-4">Game Arena</h1>
              <p className="gaming-subtitle lead">
                Join exciting tournaments for PUBG, Free Fire, Ludo, 8 Ball Pool, and other multiplayer games.
                Compete with players worldwide and win amazing prizes!
              </p>
              <div className="d-flex flex-column flex-md-row gap-2 gap-md-3 mt-4">
                <Link to="/tournaments" className="mb-2 mb-md-0 w-100 w-md-auto">
                  <Button className="gaming-btn w-100">Browse Tournaments</Button>
                </Link>
                {!currentUser && (
                  <Link to="/signup" className="mb-2 mb-md-0 w-100 w-md-auto">
                    <Button className="gaming-btn gaming-btn-outline w-100">Sign Up</Button>
                  </Link>
                )}
              </div>
            </Col>
            <Col md={6}>
              <div className="hero-image-container">
                {/* Placeholder with lazy-loaded image */}
                <img 
                  src={heroPlaceholder}
                  data-src={require('../../assets/hero-background-optimized.jpg')}
                  alt="PUBG Tournament" 
                  className={`img-fluid rounded shadow ${heroLoaded ? 'fade-in' : ''}`}
                  loading="eager"
                  width="600"
                  height="400"
                />
              </div>
            </Col>
          </Row>
        </Container>
      </div>

      {/* Featured Tournaments */}
      <Container className="py-5">
        <h2 className="gaming-section-title">Featured Tournaments</h2>
        {error && <Alert variant="danger" className="text-center">{error}</Alert>}
        
        {loadingFeatured ? (
          <div className="text-center p-4">Loading tournaments...</div>
        ) : featuredTournaments.length === 0 ? (
          <div className="text-center p-4">
            <p>No featured tournaments available at the moment.</p>
            <Link to="/tournaments">
              <Button className="gaming-btn">Browse All Tournaments</Button>
            </Link>
          </div>
        ) : (
          <Suspense fallback={<div className="text-center p-4">Loading tournaments...</div>}>
            <Carousel className="mb-5 tournament-carousel" interval={5000}>
              {featuredTournaments.map((tournament) => (
                <Carousel.Item key={tournament.id}>
                  <div className="d-flex justify-content-center">
                    <div className="carousel-card-container" style={{ maxWidth: '800px' }}>
                      <Card className="gaming-card text-center">
                        <Card.Header as="h5">{tournament.gameName}</Card.Header>
                        <Card.Body>
                          {tournament.gameLogo && (
                            <div className="text-center mb-3">
                              <img 
                                src={tournament.gameLogo} 
                                alt="Game Logo" 
                                style={{ maxHeight: '100px', maxWidth: '100%', objectFit: 'contain' }} 
                                className="game-logo-img"
                              />
                            </div>
                          )}
                          <Card.Title>Rs. {tournament.prizePool} Prize Pool</Card.Title>
                          <Card.Text>
                            {tournament.gameType} tournament with exciting prizes!
                            {tournament.map && (
                              <div className="mt-2">
                                <strong>Map:</strong> {tournament.map}
                              </div>
                            )}
                            {tournament.version && (
                              <div>
                                <strong>Version:</strong> {tournament.version}
                              </div>
                            )}
                          </Card.Text>
                          <Link to={`/tournaments/${tournament.id}`}>
                            <Button className="gaming-btn">View Details</Button>
                          </Link>
                        </Card.Body>
                        <Card.Footer 
                          className={`${tournament.status === 'live' ? 'live' : 
                                      tournament.status === 'completed' ? 'bg-secondary text-white' : 
                                      'text-muted'}`}
                        >
                          {tournament.status === 'upcoming' ? 'Registration open' : 
                           tournament.status === 'live' ? 'LIVE NOW' : 
                           'Tournament ended'}
                        </Card.Footer>
                      </Card>
                    </div>
                  </div>
                </Carousel.Item>
              ))}
            </Carousel>
          </Suspense>
        )}

        {/* How It Works */}
        <h2 className="gaming-section-title">How It Works</h2>
        <Row className="mb-5">
          <Col md={3} className="mb-4">
            <Card className="gaming-step-card h-100 text-center">
              <Card.Body>
                <div className="gaming-step-number">
                  <span>1</span>
                </div>
                <Card.Title>Sign Up</Card.Title>
                <Card.Text>
                  Create an account to get started. It&apos;s free and only takes a minute.
                </Card.Text>
              </Card.Body>
            </Card>
          </Col>
          <Col md={3} className="mb-4">
            <Card className="gaming-step-card h-100 text-center">
              <Card.Body>
                <div className="gaming-step-number">
                  <span>2</span>
                </div>
                <Card.Title>Recharge Wallet</Card.Title>
                <Card.Text>
                  Add funds to your wallet from your profile using secure payment methods. Your transactions are protected with encryption.
                </Card.Text>
              </Card.Body>
            </Card>
          </Col>
          <Col md={3} className="mb-4">
            <Card className="gaming-step-card h-100 text-center">
              <Card.Body>
                <div className="gaming-step-number">
                  <span>3</span>
                </div>
                <Card.Title>Join Tournaments</Card.Title>
                <Card.Text>
                  Browse available tournaments and join the ones you&apos;re interested in by paying the entry fee.
                </Card.Text>
              </Card.Body>
            </Card>
          </Col>
          <Col md={3} className="mb-4">
            <Card className="gaming-step-card h-100 text-center">
              <Card.Body>
                <div className="gaming-step-number">
                  <span>4</span>
                </div>
                <Card.Title>Compete & Win</Card.Title>
                <Card.Text>
                  Participate in the tournament at the scheduled time and compete for the prize pool.
                </Card.Text>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* Call to Action */}
        <div className="gaming-cta text-center py-5 mt-5">
          <Container>
            <h3 className="gaming-cta-title mb-4">Ready to join the competition?</h3>
            <Link to="/tournaments">
              <Button className="gaming-btn" size="lg">Browse All Tournaments</Button>
            </Link>
          </Container>
        </div>
      </Container>
    </div>
  );
}

export default HomePage;

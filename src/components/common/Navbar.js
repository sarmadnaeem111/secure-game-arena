import React from 'react';
import { Navbar, Nav, Container, Button } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

function NavigationBar() {
  const { currentUser, logout, userRole } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Failed to log out', error);
    }
  }

  return (
    <Navbar className="navbar-gradient" variant="dark" expand="lg" sticky="top">
      <Container>
        <Navbar.Brand as={Link} to="/" className="py-2">
          Game Arena
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto">
            <Nav.Link as={Link} to="/" className="py-2 py-lg-0">Home</Nav.Link>
            <Nav.Link as={Link} to="/tournaments" className="py-2 py-lg-0">Tournaments</Nav.Link>
            {currentUser && (
              <>
                <Nav.Link as={Link} to="/my-tournaments" className="py-2 py-lg-0">My Tournaments</Nav.Link>
                <Nav.Link as={Link} to="/create-tournament" className="py-2 py-lg-0">Create Tournament</Nav.Link>
              </>
            )}
            {userRole === 'admin' && (
              <>
                <Nav.Link as={Link} to="/admin" className="py-2 py-lg-0">Admin Dashboard</Nav.Link>
                <Nav.Link as={Link} to="/admin/tournament-approval" className="py-2 py-lg-0">Tournament Approval</Nav.Link>
              </>
            )}
          </Nav>
          <Nav className="d-flex flex-column flex-lg-row align-items-start align-items-lg-center mt-3 mt-lg-0">
            {currentUser ? (
              <>
                <Nav.Link as={Link} to="/profile" className="py-2 py-lg-0 mb-2 mb-lg-0">Profile</Nav.Link>
                <Button variant="outline-light" onClick={handleLogout} className="my-2 my-lg-0 w-100 w-lg-auto">Logout</Button>
              </>
            ) : (
              <>
                <Nav.Link as={Link} to="/login" className="py-2 py-lg-0 mb-2 mb-lg-0">Login</Nav.Link>
                <Nav.Link as={Link} to="/signup" className="py-2 py-lg-0">Sign Up</Nav.Link>
              </>
            )}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}

export default NavigationBar;
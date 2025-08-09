import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Alert, Badge, ProgressBar, ListGroup } from 'react-bootstrap';
import { threatDetection, securityEducation } from '../../utils/securityMonitor';
import { getSecurityDashboard } from '../../utils/rateLimiter';

const SecurityDashboard = ({ userId }) => {
  const [securityStats, setSecurityStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [userSecurityReport, setUserSecurityReport] = useState(null);
  const [securityTips, setSecurityTips] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSecurityData();
    const interval = setInterval(loadSecurityData, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [userId]);

  const loadSecurityData = async () => {
    try {
      const [stats, analyticsData, userReport] = await Promise.all([
        getSecurityDashboard(),
        threatDetection.getSecurityAnalytics('24h'),
        securityEducation.generateUserSecurityReport(userId)
      ]);

      setSecurityStats(stats);
      setAnalytics(analyticsData);
      setUserSecurityReport(userReport);
      setSecurityTips(securityEducation.getPersonalizedTips({}));
      setLoading(false);
    } catch (error) {
      console.error('Failed to load security data:', error);
      setLoading(false);
    }
  };

  const getSeverityColor = (severity) => {
    const colors = {
      CRITICAL: 'danger',
      HIGH: 'warning',
      MEDIUM: 'info',
      LOW: 'secondary'
    };
    return colors[severity] || 'secondary';
  };

  const getSecurityScoreColor = (score) => {
    if (score >= 90) return 'success';
    if (score >= 70) return 'warning';
    return 'danger';
  };

  if (loading) {
    return (
      <div className="text-center p-5">
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Loading security data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="security-dashboard p-4">
      <h2 className="mb-4">Security Dashboard</h2>
      
      {/* Security Overview Cards */}
      <Row className="mb-4">
        <Col md={3}>
          <Card className="h-100">
            <Card.Body className="text-center">
              <Card.Title>Blocked IPs</Card.Title>
              <h2 className="text-danger">{securityStats?.blockedIPs || 0}</h2>
              <small className="text-muted">In last 24h</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="h-100">
            <Card.Body className="text-center">
              <Card.Title>Total Threats</Card.Title>
              <h2 className="text-warning">{analytics?.totalThreats || 0}</h2>
              <small className="text-muted">Detected threats</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="h-100">
            <Card.Body className="text-center">
              <Card.Title>Security Score</Card.Title>
              <h2 className={`text-${getSecurityScoreColor(userSecurityReport?.securityScore || 100)}`}>
                {userSecurityReport?.securityScore || 100}
              </h2>
              <small className="text-muted">Your account security</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="h-100">
            <Card.Body className="text-center">
              <Card.Title>Active Threats</Card.Title>
              <h2 className="text-info">{securityStats?.activeThreats || 0}</h2>
              <small className="text-muted">Currently active</small>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Threat Analytics */}
      {analytics && (
        <Row className="mb-4">
          <Col md={6}>
            <Card>
              <Card.Header>
                <Card.Title>Threat Types</Card.Title>
              </Card.Header>
              <Card.Body>
                <ListGroup variant="flush">
                  {Object.entries(analytics.threatTypes).map(([type, count]) => (
                    <ListGroup.Item key={type} className="d-flex justify-content-between">
                      <span>{type.replace('_', ' ')}</span>
                      <Badge bg="danger">{count}</Badge>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              </Card.Body>
            </Card>
          </Col>
          <Col md={6}>
            <Card>
              <Card.Header>
                <Card.Title>Severity Distribution</Card.Title>
              </Card.Header>
              <Card.Body>
                {Object.entries(analytics.severityDistribution).map(([severity, count]) => (
                  <div key={severity} className="mb-2">
                    <div className="d-flex justify-content-between">
                      <span>{severity}</span>
                      <span>{count}</span>
                    </div>
                    <ProgressBar 
                      variant={getSeverityColor(severity)}
                      now={count}
                      max={Math.max(...Object.values(analytics.severityDistribution))}
                    />
                  </div>
                ))}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {/* User Security Report */}
      {userSecurityReport && (
        <Row className="mb-4">
          <Col md={12}>
            <Card>
              <Card.Header>
                <Card.Title>Your Security Report</Card.Title>
              </Card.Header>
              <Card.Body>
                <Row>
                  <Col md={6}>
                    <h5>Security Score</h5>
                    <ProgressBar 
                      variant={getSecurityScoreColor(userSecurityReport.securityScore)}
                      now={userSecurityReport.securityScore}
                      label={`${userSecurityReport.securityScore}%`}
                      className="mb-3"
                    />
                  </Col>
                  <Col md={6}>
                    <h5>Recent Activity</h5>
                    <p>Total Incidents: {userSecurityReport.totalIncidents}</p>
                    <p>Last Incident: {userSecurityReport.lastIncident ? new Date(userSecurityReport.lastIncident.toDate()).toLocaleString() : 'None'}</p>
                  </Col>
                </Row>
                
                {userSecurityReport.recommendations.length > 0 && (
                  <div>
                    <h5>Recommendations</h5>
                    <ListGroup>
                      {userSecurityReport.recommendations.map((rec, index) => (
                        <ListGroup.Item key={index} variant="warning">
                          {rec}
                        </ListGroup.Item>
                      ))}
                    </ListGroup>
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {/* Security Tips */}
      <Row>
        <Col md={12}>
          <Card>
            <Card.Header>
              <Card.Title>Security Tips</Card.Title>
            </Card.Header>
            <Card.Body>
              <Row>
                {securityTips.map((tip, index) => (
                  <Col md={4} key={index} className="mb-3">
                    <Alert variant={tip.priority === 'CRITICAL' ? 'danger' : 'info'}>
                      <Alert.Heading>{tip.title}</Alert.Heading>
                      <p>{tip.content}</p>
                    </Alert>
                  </Col>
                ))}
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default SecurityDashboard;
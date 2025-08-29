/**
 * AI-Enhanced Security Threat Detection Test Suite
 * Tests the complete security threat detection system with synthetic data
 */

import { SecurityThreatDetectionSystem, RealTimeThreatMonitor, SecurityEvent, ThreatDetectionResult } from './security-threat-detection';

/**
 * Generate synthetic security events for testing
 */
function generateSyntheticEvents(count: number): SecurityEvent[] {
  const events: SecurityEvent[] = [];
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'curl/7.68.0',
    'python-requests/2.25.1',
    'BadBot/1.0'
  ];
  
  const endpoints = [
    '/api/search', '/api/auth/login', '/api/users/profile', '/api/data/export',
    '/admin/dashboard', '/debug/info', '/.env', '/api/internal/config'
  ];
  
  const countries = ['US', 'GB', 'DE', 'FR', 'CN', 'RU', 'IR'];
  const cities = ['New York', 'London', 'Berlin', 'Paris', 'Beijing', 'Moscow', 'Tehran'];
  
  for (let i = 0; i < count; i++) {
    const timestamp = Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000; // Last 7 days
    const ip = `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
    const countryIdx = Math.floor(Math.random() * countries.length);
    
    events.push({
      id: `event_${i}`,
      timestamp,
      userId: Math.random() > 0.3 ? `user_${Math.floor(Math.random() * 100)}` : undefined,
      sessionId: `session_${Math.floor(Math.random() * 1000)}`,
      ip,
      userAgent: userAgents[Math.floor(Math.random() * userAgents.length)],
      endpoint: endpoints[Math.floor(Math.random() * endpoints.length)],
      method: ['GET', 'POST', 'PUT', 'DELETE'][Math.floor(Math.random() * 4)],
      statusCode: Math.random() > 0.85 ? 
        [400, 401, 403, 404, 500][Math.floor(Math.random() * 5)] : 
        [200, 201, 204][Math.floor(Math.random() * 3)],
      responseTime: Math.floor(Math.random() * 5000),
      dataSize: Math.floor(Math.random() * 1000000),
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      payload: Math.random() > 0.8 ? { query: "'; DROP TABLE users; --" } : { query: 'normal query' },
      geoLocation: {
        country: countries[countryIdx],
        city: cities[countryIdx],
        lat: Math.random() * 180 - 90,
        lon: Math.random() * 360 - 180
      }
    });
  }
  
  return events;
}

/**
 * Generate malicious security events for testing threat detection
 */
function generateMaliciousEvents(): SecurityEvent[] {
  const maliciousEvents: SecurityEvent[] = [];
  const timestamp = Date.now();
  
  // SQL Injection attack
  maliciousEvents.push({
    id: 'malicious_sql_1',
    timestamp,
    userId: 'attacker_1',
    sessionId: 'attack_session_1',
    ip: '192.168.1.100',
    userAgent: 'sqlmap/1.0',
    endpoint: '/api/users',
    method: 'POST',
    statusCode: 500,
    responseTime: 2000,
    dataSize: 1024,
    headers: { 'Content-Type': 'application/json' },
    payload: { username: "admin'; DROP TABLE users; --", password: 'test' },
    geoLocation: { country: 'CN', city: 'Beijing', lat: 39.9, lon: 116.4 }
  });
  
  // XSS attack
  maliciousEvents.push({
    id: 'malicious_xss_1',
    timestamp: timestamp + 1000,
    userId: 'attacker_2',
    sessionId: 'attack_session_2',
    ip: '10.0.0.50',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    endpoint: '/api/comments',
    method: 'POST',
    statusCode: 200,
    responseTime: 500,
    dataSize: 512,
    headers: { 'Content-Type': 'application/json' },
    payload: { comment: '<script>alert("XSS")</script>' },
    geoLocation: { country: 'RU', city: 'Moscow', lat: 55.7, lon: 37.6 }
  });
  
  // Brute force attack (multiple failed login attempts)
  for (let i = 0; i < 15; i++) {
    maliciousEvents.push({
      id: `brute_force_${i}`,
      timestamp: timestamp + (i * 1000),
      userId: 'target_user',
      sessionId: `brute_session_${i}`,
      ip: '203.0.113.10',
      userAgent: 'python-requests/2.25.1',
      endpoint: '/api/auth/login',
      method: 'POST',
      statusCode: 401,
      responseTime: 100,
      dataSize: 256,
      headers: { 'Content-Type': 'application/json' },
      payload: { username: 'admin', password: `password${i}` },
      geoLocation: { country: 'IR', city: 'Tehran', lat: 35.7, lon: 51.4 }
    });
  }
  
  // DDoS attack (high request rate)
  for (let i = 0; i < 150; i++) {
    maliciousEvents.push({
      id: `ddos_${i}`,
      timestamp: timestamp + (i * 100), // 10 requests per second
      ip: '198.51.100.20',
      userAgent: 'BadBot/1.0',
      endpoint: '/api/search',
      method: 'GET',
      statusCode: 200,
      responseTime: 50,
      dataSize: 1024,
      headers: { 'User-Agent': 'BadBot/1.0' },
      geoLocation: { country: 'KP', city: 'Pyongyang', lat: 39.0, lon: 125.8 }
    });
  }
  
  // Data exfiltration attempt
  maliciousEvents.push({
    id: 'data_exfiltration_1',
    timestamp: timestamp + 10000,
    userId: 'insider_threat',
    sessionId: 'exfiltration_session',
    ip: '172.16.0.100',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    endpoint: '/api/data/export',
    method: 'GET',
    statusCode: 200,
    responseTime: 30000, // 30 seconds - large download
    dataSize: 50000000, // 50MB
    headers: { 'Accept': '*/*' },
    geoLocation: { country: 'US', city: 'New York', lat: 40.7, lon: -74.0 }
  });
  
  return maliciousEvents;
}

/**
 * Test the security threat detection system
 */
async function testSecurityThreatDetection(): Promise<void> {
  console.log('🔒 Starting AI-Enhanced Security Threat Detection Tests...\n');
  
  // Initialize the detection system
  const detectionSystem = new SecurityThreatDetectionSystem({
    models: {
      anomalyDetection: {
        enabled: true,
        isolationForest: {
          nTrees: 50, // Reduced for testing
          maxSamples: 128,
          contamination: 0.1
        },
        autoencoder: {
          enabled: false // Disabled for faster testing
        }
      }
    },
    thresholds: {
      low: 0.3,
      medium: 0.6,
      high: 0.8,
      critical: 0.9
    },
    autoResponse: {
      enabled: true
    }
  });
  
  // Generate training data
  console.log('📊 Generating synthetic training data...');
  const trainingEvents = generateSyntheticEvents(1000);
  
  // Train the models
  console.log('🧠 Training ML models...');
  await detectionSystem.train(trainingEvents);
  
  // Test with normal events
  console.log('\n✅ Testing with normal events...');
  const normalEvents = generateSyntheticEvents(10);
  for (const event of normalEvents.slice(0, 3)) {
    const result = await detectionSystem.analyzeEvent(event);
    console.log(`Event ${event.id}: ${result.threatLevel} (score: ${result.score.toFixed(3)})`);
    if (result.threats.length > 0) {
      console.log(`  Threats: ${result.threats.map(t => t.type).join(', ')}`);
    }
  }
  
  // Test with malicious events
  console.log('\n🚨 Testing with malicious events...');
  const maliciousEvents = generateMaliciousEvents();
  
  const testCases = [
    { name: 'SQL Injection', events: maliciousEvents.filter(e => e.id.includes('sql')) },
    { name: 'XSS Attack', events: maliciousEvents.filter(e => e.id.includes('xss')) },
    { name: 'Brute Force', events: maliciousEvents.filter(e => e.id.includes('brute_force')).slice(-1) }, // Test last attempt
    { name: 'DDoS Attack', events: maliciousEvents.filter(e => e.id.includes('ddos')).slice(-1) }, // Test last request
    { name: 'Data Exfiltration', events: maliciousEvents.filter(e => e.id.includes('exfiltration')) }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n🎯 Testing ${testCase.name}:`);
    for (const event of testCase.events) {
      const result = await detectionSystem.analyzeEvent(event);
      console.log(`  ${event.id}: ${result.threatLevel} (score: ${result.score.toFixed(3)})`);
      
      if (result.threats.length > 0) {
        console.log(`    Threats detected: ${result.threats.map(t => `${t.type} (${t.confidence.toFixed(2)})`).join(', ')}`);
      }
      
      if (result.anomalies.length > 0) {
        console.log(`    Anomalies: ${result.anomalies.length} detected`);
      }
      
      if (result.recommendations.length > 0) {
        console.log(`    Recommendations: ${result.recommendations.slice(0, 2).join('; ')}`);
      }
    }
  }
  
  // Test real-time monitoring
  console.log('\n⏱️  Testing real-time threat monitoring...');
  const monitor = new RealTimeThreatMonitor(detectionSystem);
  monitor.start(500); // Process every 500ms
  
  // Add events to queue
  const testEvents = [...normalEvents.slice(0, 2), ...maliciousEvents.slice(0, 3)];
  testEvents.forEach(event => monitor.addEvent(event));
  
  // Wait for processing
  await new Promise(resolve => setTimeout(resolve, 2000));
  monitor.stop();
  
  console.log('\n✅ Security threat detection tests completed successfully!');
}

/**
 * Test performance and accuracy metrics
 */
async function testPerformanceMetrics(): Promise<void> {
  console.log('\n📈 Testing performance metrics...');
  
  const detectionSystem = new SecurityThreatDetectionSystem();
  const events = generateSyntheticEvents(100);
  
  // Measure training time
  const trainStart = Date.now();
  await detectionSystem.train(events);
  const trainTime = Date.now() - trainStart;
  
  // Measure detection time
  const testEvents = generateSyntheticEvents(50);
  const detectStart = Date.now();
  
  const results: ThreatDetectionResult[] = [];
  for (const event of testEvents) {
    const result = await detectionSystem.analyzeEvent(event);
    results.push(result);
  }
  
  const detectTime = Date.now() - detectStart;
  
  // Calculate metrics
  const avgDetectionTime = detectTime / testEvents.length;
  const threatLevels = results.map(r => r.threatLevel);
  const highThreats = threatLevels.filter(t => t === 'HIGH' || t === 'CRITICAL').length;
  
  console.log(`📊 Performance Metrics:`);
  console.log(`  Training time: ${trainTime}ms`);
  console.log(`  Average detection time: ${avgDetectionTime.toFixed(2)}ms per event`);
  console.log(`  Total events processed: ${results.length}`);
  console.log(`  High/Critical threats detected: ${highThreats}`);
  console.log(`  Threat distribution: ${JSON.stringify(
    threatLevels.reduce((acc, level) => {
      acc[level] = (acc[level] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  )}`);
}

/**
 * Run all tests
 */
export async function runSecurityTests(): Promise<void> {
  try {
    await testSecurityThreatDetection();
    await testPerformanceMetrics();
    
    console.log('\n🎉 All security threat detection tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runSecurityTests();
}

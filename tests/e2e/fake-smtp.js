// Minimal in-process SMTP server for E2E tests. Captures every mail that
// arrives and exposes it to the test process. Not a complete SMTP
// implementation — just enough for nodemailer to deliver a message.
//
// Used in beforeAll by tests/e2e/notifications.spec.js. The playwright
// config sets SMTP_HOST/SMTP_PORT to match the port this module binds to.

const net = require('net');

function startFakeSmtp({ host = '127.0.0.1', port = 2587 } = {}) {
  const captured = [];

  const server = net.createServer(socket => {
    let mode = 'COMMAND';
    let envelope = {};
    let dataBuffer = '';

    const write = line => socket.write(`${line}\r\n`);
    write('220 fake-smtp.test ESMTP ready');

    const parseAddress = value => {
      const trimmed = value.replace(/^(MAIL FROM:|RCPT TO:)/i, '').trim();
      return trimmed.replace(/[<>]/g, '');
    };

    const handleCommand = line => {
      if (/^EHLO\b/i.test(line)) {
        socket.write('250-fake-smtp.test\r\n250 OK\r\n');
        return;
      }
      if (/^HELO\b/i.test(line)) {
        socket.write('250 fake-smtp.test\r\n');
        return;
      }
      if (/^MAIL FROM:/i.test(line)) {
        envelope.from = parseAddress(line);
        write('250 OK');
        return;
      }
      if (/^RCPT TO:/i.test(line)) {
        envelope.to = parseAddress(line);
        write('250 OK');
        return;
      }
      if (/^DATA/i.test(line)) {
        mode = 'DATA';
        write('354 End data with <CR><LF>.<CR><LF>');
        return;
      }
      if (/^QUIT/i.test(line)) {
        write('221 Bye');
        socket.end();
        return;
      }
      if (/^(RSET|NOOP|VRFY)\b/i.test(line)) {
        write('250 OK');
        return;
      }
      write('250 OK');
    };

    const handleData = line => {
      if (line === '.') {
        captured.push({
          envelope,
          data: dataBuffer,
          receivedAt: new Date().toISOString()
        });
        envelope = {};
        dataBuffer = '';
        mode = 'COMMAND';
        write('250 OK message accepted');
        return;
      }
      // SMTP transparency: lines starting with ".."
      // are unescaped to "." per RFC 5321 §4.5.2.
      const unescaped = line.startsWith('..') ? line.slice(1) : line;
      dataBuffer += `${unescaped}\r\n`;
    };

    let buffer = '';
    socket.on('data', chunk => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split('\r\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (mode === 'COMMAND') handleCommand(line);
        else handleData(line);
      }
    });
    socket.on('error', () => {});
    socket.on('end', () => {});
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      resolve({
        server,
        host,
        port,
        captured,
        stop: () => new Promise(resolveStop => server.close(() => resolveStop())),
        waitForCount: (count, timeoutMs = 10_000) => new Promise((resolveCount, rejectCount) => {
          const startedAt = Date.now();
          const tick = () => {
            if (captured.length >= count) return resolveCount();
            if (Date.now() - startedAt > timeoutMs) {
              return rejectCount(new Error(`fake-smtp: timeout waiting for ${count} mail(s), got ${captured.length}`));
            }
            setTimeout(tick, 100);
          };
          tick();
        })
      });
    });
  });
}

module.exports = { startFakeSmtp };
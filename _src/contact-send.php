<?php
/*
 * VLORÁ contact form: receives the enquiry from /pages/contact/ and emails it to the team.
 * Upload this file to the website root (next to index.html). No database, no third-party service.
 *
 * Settings: change TO_EMAIL to change where enquiries land. FROM_EMAIL must be a real mailbox on vlora.ae
 * (info@vlora.ae) so the mail is not marked as spam.
 */
declare(strict_types=1);

const TO_EMAIL   = 'info@vlora.ae';
const FROM_EMAIL = 'info@vlora.ae';
const FROM_NAME  = 'VLORA Website';
const TOPICS     = ['Choosing a piece', 'Bespoke or custom design', 'Care, cleaning or repair', 'An order or delivery', 'Something else'];
const MAX_PER_HOUR = 5;   // per visitor
const MAX_PHOTO    = 5 * 1024 * 1024;  // one photo, up to 5 MB
const MIN_SECONDS  = 4;   // a real person needs a few seconds to fill the form

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function reply(int $code, bool $ok, string $msg = ''): never {
    http_response_code($code);
    echo json_encode(['ok' => $ok, 'message' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

function clean(string $s, int $max): string {
    $s = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $s) ?? '';
    return mb_substr(trim($s), 0, $max);
}

function one_line(string $s): string {
    return trim(preg_replace('/\s+/u', ' ', $s) ?? '');
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') reply(405, false, 'Method not allowed.');

// Only accept submissions that come from this website.
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '') {
    $oh = parse_url($origin, PHP_URL_HOST) ?: '';
    $hh = preg_replace('/:\d+$/', '', $_SERVER['HTTP_HOST'] ?? '');
    if (strcasecmp($oh, (string)$hh) !== 0) reply(403, false, 'Not allowed.');
}

// Bots: a hidden field real visitors never fill in.
if (clean((string)($_POST['website'] ?? ''), 200) !== '') reply(200, true);

// Bots: submitted faster than a person can type.
$t = (int)($_POST['t'] ?? 0);
if ($t > 0 && (time() - intdiv($t, 1000)) < MIN_SECONDS) reply(429, false, 'Please take a moment and try again.');

// Per-visitor limit.
$dir = sys_get_temp_dir() . '/vlora-contact';
if (!is_dir($dir)) @mkdir($dir, 0700, true);
$key = $dir . '/' . hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? 'x') . '|vlora') . '.json';
$hits = [];
if (is_file($key)) {
    $hits = json_decode((string)@file_get_contents($key), true) ?: [];
    $hits = array_values(array_filter($hits, fn($x) => is_int($x) && $x > time() - 3600));
}
if (count($hits) >= MAX_PER_HOUR) reply(429, false, 'Too many messages. Please try again later or message us on WhatsApp.');

$name  = one_line(clean((string)($_POST['name'] ?? ''), 80));
$phone = one_line(clean((string)($_POST['phone'] ?? ''), 30));
$email = one_line(clean((string)($_POST['email'] ?? ''), 120));
$topic = clean((string)($_POST['topic'] ?? ''), 60);
$msg   = clean((string)($_POST['msg'] ?? ''), 3000);

if (mb_strlen($name) < 2) reply(422, false, 'Please enter your name.');
if (!preg_match('/^[0-9+()\-\s.]{6,30}$/', $phone)) reply(422, false, 'Please enter a valid phone number.');
if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) reply(422, false, 'Please check your email address.');
if (!in_array($topic, TOPICS, true)) $topic = 'Something else';
if (mb_strlen($msg) < 5) reply(422, false, 'Please write a short message.');

// Optional single photo.
$att = null;
if (isset($_FILES['photo']) && (int)($_FILES['photo']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
    $pf = $_FILES['photo'];
    if ((int)$pf['error'] !== UPLOAD_ERR_OK || !is_uploaded_file((string)$pf['tmp_name'])) reply(422, false, 'The photo could not be uploaded. Please try a smaller image.');
    if ((int)$pf['size'] > MAX_PHOTO) reply(422, false, 'Please choose a photo under 5 MB.');
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file((string)$pf['tmp_name']);
    $ext = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/heic' => 'heic', 'image/heif' => 'heic'][$mime] ?? null;
    if ($ext === null) reply(422, false, 'Please attach a JPG, PNG or WebP photo.');
    if ($ext !== 'heic' && @getimagesize((string)$pf['tmp_name']) === false) reply(422, false, 'That file does not look like a photo.');
    $att = ['data' => (string)file_get_contents((string)$pf['tmp_name']), 'mime' => $mime, 'name' => 'enquiry-photo.' . $ext];
}

$when = (new DateTime('now', new DateTimeZone('Asia/Dubai')))->format('D j M Y, H:i') . ' (Dubai)';
$body = "New enquiry from the VLORA website\r\n"
      . "-----------------------------------\r\n"
      . "Topic:   $topic\r\n"
      . "Name:    $name\r\n"
      . "Phone:   $phone\r\n"
      . "Email:   " . ($email !== '' ? $email : '(not given)') . "\r\n"
      . "Sent:    $when\r\n"
      . "Photo:   " . ($att ? 'attached (' . $att['name'] . ')' : 'none') . "\r\n\r\n"
      . "Message:\r\n" . str_replace(["\r\n", "\r"], "\n", $msg) . "\r\n\r\n"
      . "-----------------------------------\r\n"
      . "Reply to this email to answer the customer" . ($email === '' ? ", or call or WhatsApp them on the number above." : ".") . "\r\n";
$body = str_replace("\n", "\r\n", str_replace("\r\n", "\n", $body));

$subject = mb_encode_mimeheader('Website enquiry: ' . $topic . ' - ' . $name, 'UTF-8', 'B', "\r\n");
$headers = [
    'From: ' . mb_encode_mimeheader(FROM_NAME, 'UTF-8', 'B') . ' <' . FROM_EMAIL . '>',
    'MIME-Version: 1.0',
    'X-Mailer: vlora-contact-form',
];
if ($email !== '') $headers[] = 'Reply-To: ' . $email;
if ($att) {
    $b = 'vlora-' . bin2hex(random_bytes(12));
    $headers[] = 'Content-Type: multipart/mixed; boundary="' . $b . '"';
    $body = "--$b\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n" . $body . "\r\n"
          . "--$b\r\nContent-Type: {$att['mime']}; name=\"{$att['name']}\"\r\nContent-Transfer-Encoding: base64\r\n"
          . "Content-Disposition: attachment; filename=\"{$att['name']}\"\r\n\r\n"
          . chunk_split(base64_encode($att['data']), 76, "\r\n") . "--$b--\r\n";
} else {
    $headers[] = 'Content-Type: text/plain; charset=UTF-8';
    $headers[] = 'Content-Transfer-Encoding: 8bit';
}

$sent = @mail(TO_EMAIL, $subject, $body, implode("\r\n", $headers), '-f' . FROM_EMAIL);
if (!$sent) {
    error_log('vlora contact form: mail() failed');
    reply(500, false, 'We could not send your message just now.');
}

$hits[] = time();
@file_put_contents($key, json_encode($hits), LOCK_EX);
reply(200, true);

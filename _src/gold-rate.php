<?php
// VLORÁ live gold rate. Reads the Dubai gold rate page, caches it, returns JSON.
// Called by the website every few minutes; the source is hit at most once per TTL.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
$SRC = 'https://dubaicityofgold.com/dubai-gold-rate-today/';
$TTL = 180; // seconds between reads of the source
$cache = __DIR__ . '/gold-rate-cache.json';

$old = is_file($cache) ? json_decode(@file_get_contents($cache), true) : null;
if ($old && isset($old['fetched']) && time() - $old['fetched'] < $TTL) { echo json_encode($old); exit; }

function grab($url) {
  $ctx = stream_context_create(['http' => ['timeout' => 8, 'header' => "User-Agent: Mozilla/5.0 (compatible; VLORA-rate/1.0)\r\n"]]);
  $h = @file_get_contents($url, false, $ctx);
  if ($h === false && function_exists('curl_init')) {
    $c = curl_init($url);
    curl_setopt_array($c, [CURLOPT_RETURNTRANSFER => 1, CURLOPT_TIMEOUT => 8, CURLOPT_FOLLOWLOCATION => 1, CURLOPT_USERAGENT => 'Mozilla/5.0 (compatible; VLORA-rate/1.0)']);
    $h = curl_exec($c); curl_close($c);
  }
  return $h;
}

$html = grab($SRC);
$rates = [];
if ($html) {
  $txt = preg_replace('/<(script|style)\b.*?<\/\1>/si', ' ', $html);
  $txt = html_entity_decode(strip_tags(preg_replace('/<[^>]+>/', ' ', $txt)));
  $txt = preg_replace('/\s+/', ' ', $txt);
  foreach ([24, 22, 21, 18, 14] as $k) {
    if (preg_match('/\b' . $k . '\s*K(?:arat|T)?\b[^0-9]{0,60}?(\d{2,3}(?:,\d{3})*(?:\.\d{1,2})?)/i', $txt, $m)) {
      $v = (float)str_replace(',', '', $m[1]);
      if ($v > 100 && $v < 3000) $rates[$k] = $v; // sanity range, AED per gram
    }
  }
}
// all four must be present and in descending order, otherwise keep the last good values
$ok = isset($rates[24], $rates[22], $rates[18], $rates[14]) && $rates[24] > $rates[22] && $rates[22] > $rates[18] && $rates[18] > $rates[14];
if ($ok) {
  $out = ['rates' => $rates, 'fetched' => time(), 'stale' => false, 'source' => 'dubaicityofgold.com'];
  @file_put_contents($cache, json_encode($out), LOCK_EX);
  echo json_encode($out);
} elseif ($old) {
  $old['stale'] = true; echo json_encode($old);
} else {
  http_response_code(503); echo json_encode(['error' => 'rate unavailable']);
}

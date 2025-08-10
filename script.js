// ==== CONFIG ====
const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;
const EARTH_RADIUS = 6378.137; // km
const MOON_RADIUS = 1737.4; // km
const MU_EARTH = 398600.4418; // km^3/s^2
const MU_MOON = 4902.800066; // km^3/s^2
const MOON_ORBIT_A = 384400; // km
const MOON_ORBIT_E = 0.0549; // eccentricity
const MOON_ORBIT_I = 5.145 * DEG2RAD; // inclination
const IST_OFFSET_HRS = 5.5;

// Elements
const canvas = document.getElementById("trajectoryCanvas");
const ctx = canvas.getContext("2d");
const resultsEl = document.getElementById("results");
let w = canvas.width = canvas.offsetWidth;
let h = canvas.height = canvas.offsetHeight;

// Camera state
let camDist = 900000; // km
let rotX = 0.3;
let rotY = 0.4;
let drag = false;
let lastX, lastY;

// Touch state
let touchMode = null; // 'rotate' or 'zoom'
let pinchStartDist = null;
let pinchStartCamDist = null;

// === Math functions ===
function julianDate(date) {
  return date / 86400000 + 2440587.5;
}

function moonPositionJD(jd) {
  // Very simplified Keplerian + eccentricity
  const T = (jd - 2451545.0) / 36525;
  const M = (134.963 + 477198.867 * T) % 360;
  const L = (218.316 + 481267.881 * T) % 360;
  const Mm = M * DEG2RAD;
  const E = MOON_ORBIT_E;
  const a = MOON_ORBIT_A;
  const x = a * (Math.cos(Mm) - E);
  const y = a * Math.sqrt(1 - E*E) * Math.sin(Mm);
  // Rotate for inclination
  const yI = y * Math.cos(MOON_ORBIT_I);
  const zI = y * Math.sin(MOON_ORBIT_I);
  return [x, yI, zI];
}

// === Rendering ===
function project3D(x, y, z) {
  const cz = Math.cos(rotY), sz = Math.sin(rotY);
  const cy = Math.cos(rotX), sy = Math.sin(rotX);
  // Rotate around Y
  let dx = cz * x + sz * z;
  let dz = -sz * x + cz * z;
  // Rotate around X
  let dy = cy * y - sy * dz;
  dz = sy * y + cy * dz;
  const scale = 500 / (dz + camDist);
  return [w/2 + dx*scale, h/2 - dy*scale];
}

function drawScene(moonPos) {
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle = "black";
  ctx.fillRect(0,0,w,h);
  
  // Draw Earth
  let e = project3D(0,0,0);
  ctx.fillStyle = "blue";
  ctx.beginPath();
  ctx.arc(e[0], e[1], 10, 0, Math.PI*2);
  ctx.fill();

  // Draw Moon
  let m = project3D(moonPos[0], moonPos[1], moonPos[2]);
  ctx.fillStyle = "grey";
  ctx.beginPath();
  ctx.arc(m[0], m[1], 5, 0, Math.PI*2);
  ctx.fill();

  // Draw line Earth→Moon
  ctx.strokeStyle = "white";
  ctx.beginPath();
  ctx.moveTo(e[0], e[1]);
  ctx.lineTo(m[0], m[1]);
  ctx.stroke();
}

// === Input handling ===
canvas.addEventListener("mousedown", e=>{
  drag = true; lastX = e.clientX; lastY = e.clientY;
});
canvas.addEventListener("mouseup", ()=>drag=false);
canvas.addEventListener("mousemove", e=>{
  if(!drag) return;
  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;
  rotY += dx * 0.005;
  rotX += dy * 0.005;
  lastX = e.clientX; lastY = e.clientY;
});

canvas.addEventListener("touchstart", e=>{
  if(e.touches.length===1){
    touchMode='rotate';
    lastX = e.touches[0].clientX;
    lastY = e.touches[0].clientY;
  } else if(e.touches.length===2){
    touchMode='zoom';
    pinchStartDist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    pinchStartCamDist = camDist;
  }
});
canvas.addEventListener("touchmove", e=>{
  e.preventDefault();
  if(touchMode==='rotate' && e.touches.length===1){
    const dx = e.touches[0].clientX - lastX;
    const dy = e.touches[0].clientY - lastY;
    rotY += dx * 0.005;
    rotX += dy * 0.005;
    lastX = e.touches[0].clientX;
    lastY = e.touches[0].clientY;
  } else if(touchMode==='zoom' && e.touches.length===2){
    const dist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    camDist = pinchStartCamDist * (pinchStartDist / dist);
  }
},{passive:false});
canvas.addEventListener("touchend", ()=>touchMode=null);

// === Main compute handler ===
document.getElementById("computeBtn").addEventListener("click", ()=>{
  const dateStr = document.getElementById("launchDate").value;
  const timeStr = document.getElementById("launchTime").value;
  const perigee = parseFloat(document.getElementById("perigee").value);
  const apogee = parseFloat(document.getElementById("apogee").value);
  const lunarOrbitRadius = parseFloat(document.getElementById("lunarOrbitRadius").value);

  if(!dateStr || !timeStr) {
    alert("Enter launch date and time");
    return;
  }
  const launchUTC = new Date(`${dateStr}T${timeStr}Z`);
  launchUTC.setHours(launchUTC.getHours() - IST_OFFSET_HRS);
  const jd = julianDate(launchUTC);
  const moonPos = moonPositionJD(jd);
  drawScene(moonPos);

  // Placeholder for trajectory math: in full version, insert Lambert solver & Δv here
  resultsEl.textContent = 
    `Launch JD (UTC): ${jd.toFixed(10)}\n`+
    `Moon Position (km): X=${moonPos[0].toFixed(10)}, Y=${moonPos[1].toFixed(10)}, Z=${moonPos[2].toFixed(10)}\n`+
    `Parking Orbit: perigee=${perigee.toFixed(10)} km, apogee=${apogee.toFixed(10)} km\n`+
    `Target lunar orbit radius: ${lunarOrbitRadius.toFixed(10)} km`;
});

document.getElementById("downloadCsvBtn").addEventListener("click", ()=>{
  const blob = new Blob([resultsEl.textContent], {type:"text/csv"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "trajectory.csv";
  a.click();
});

document.getElementById("downloadSvgBtn").addEventListener("click", ()=>{
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <rect width="100%" height="100%" fill="black"/>
    <circle cx="${w/2}" cy="${h/2}" r="10" fill="blue"/>
  </svg>`;
  const blob = new Blob([svg], {type:"image/svg+xml"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "trajectory.svg";
  a.click();
});

// Initial draw
drawScene([MOON_ORBIT_A,0,0]);

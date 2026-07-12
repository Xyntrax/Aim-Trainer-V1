// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Lighting
scene.add(new THREE.AmbientLight(0x666666));
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 10, 5);
scene.add(light);

// HUD
let hp = 100;
let score = 0;
const hud = document.getElementById("hud");
const gameover = document.getElementById("gameover");
const instructions = document.getElementById("instructions");

// Shape factory
function makeShape(type, color, pos) {
    let geom;
    switch (type) {
        case "circle":
            geom = new THREE.SphereGeometry(0.6, 16, 16);
            break;
        case "triangle":
            geom = new THREE.TetrahedronGeometry(0.9);
            break;
        case "diamond":
            geom = new THREE.OctahedronGeometry(0.8);
            break;
        case "box":
            geom = new THREE.BoxGeometry(1.2, 1.2, 1.2);
            break;
        case "star":
            const starShape = new THREE.Shape();
            let spikes = 5,
                outer = 0.9,
                inner = 0.45,
                rot = Math.PI / 2 * 3,
                step = Math.PI / spikes;
            starShape.moveTo(0, -outer);
            for (let i = 0; i < spikes; i++) {
                starShape.lineTo(Math.cos(rot) * outer, Math.sin(rot) * outer);
                rot += step;
                starShape.lineTo(Math.cos(rot) * inner, Math.sin(rot) * inner);
                rot += step;
            }
            geom = new THREE.ExtrudeGeometry(starShape, { depth: 0.4, bevelEnabled: false });
            break;
        case "octagon":
            geom = new THREE.CylinderGeometry(0.8, 0.8, 1.2, 8);
            break;
    }
    const mat = new THREE.MeshStandardMaterial({ color, flatShading: true });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.copy(pos);
    mesh.userData.type = type;
    return mesh;
}

// Config
const colors = {
    circle: 0x00ff00,
    triangle: 0xff0000,
    diamond: 0xff8800,
    box: 0x0088ff,
    star: 0xffff00,
    octagon: 0xff00ff
};
const damageValues = {
    triangle: 8,
    diamond: 16,
    box: 25,
    star: 35,
    octagon: 40
};
let targets = [];
const TARGET_COUNT = 20;
const EXTRA_CIRCLES = 3;

// Spawn positions (front 180 degrees)
function randomPosition() {
    const dist = 6 + Math.random() * 4;
    const angle = (Math.random() * Math.PI) - Math.PI / 2; // -90°..+90°
    const maxY = 4;
    const x = Math.sin(angle) * dist;
    const z = -Math.cos(angle) * dist;
    const y = (Math.random() * 2 - 1) * maxY;
    return new THREE.Vector3(x, y, z);
}

function spawnTarget(type) {
    let pos, valid = false;
    const minDist = 2.0;
    const maxAttempts = 30;

    for (let attempt = 0; attempt < maxAttempts && !valid; attempt++) {
        pos = randomPosition();
        valid = true;
        for (let other of targets) {
            if (pos.distanceTo(other.position) < minDist) {
                valid = false;
                break;
            }
        }
    }

    if (valid) {
        const obj = makeShape(type, colors[type], pos);
        obj.userData.spawnTime = Date.now();
        scene.add(obj);
        targets.push(obj);
    }
}

function ensureTargets(count = TARGET_COUNT) {
    const circles = targets.filter(t => t.userData.type === "circle").length;
    const nonCircles = targets.length - circles;
    const desiredNonCircles = Math.floor((count - EXTRA_CIRCLES) / 2);
    const desiredCircles = count - desiredNonCircles;

    while (circles < desiredCircles) {
        spawnTarget("circle");
        circles++;
    }
    const pool = ["triangle", "diamond", "box", "star", "octagon"];
    while (targets.length < count) {
        spawnTarget(pool[Math.floor(Math.random() * pool.length)]);
    }
}

function removeTarget(obj) {
    scene.remove(obj);
    targets = targets.filter(o => o !== obj);
}

// Pointer lock (start only no restart here)
let controlsEnabled = false;
document.body.addEventListener("click", () => {
    if (!controlsEnabled && hp > 0) renderer.domElement.requestPointerLock();
});
document.addEventListener("pointerlockchange", () => {
    controlsEnabled = (document.pointerLockElement === renderer.domElement);
    instructions.style.display = controlsEnabled ? "none" : "block";
});

// Disable default context menu so right click can be used for restart
document.addEventListener("contextmenu", e => e.preventDefault());

// Mouse look
let yaw = 0,
    pitch = 0;
document.addEventListener("mousemove", (e) => {
    if (!controlsEnabled) return;
    yaw -= e.movementX * 0.002;
    pitch -= e.movementY * 0.002;
    pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));
    camera.rotation.set(pitch, yaw, 0, "YXZ");
});

// Shooting + right click restart
const raycaster = new THREE.Raycaster();
document.addEventListener("mousedown", e => {
    if (hp <= 0 && e.button === 2) {
        restartGame();
        return;
    }
    if (e.button === 0) shoot();
});

function shoot() {
    if (!controlsEnabled || hp <= 0) return;
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hits = raycaster.intersectObjects(targets);
    if (hits.length > 0) {
        const target = hits[0].object;
        const type = target.userData.type;
        removeTarget(target);

        if (type === "circle") {
            score++;
            targets.filter(t => t.userData.type !== "circle").forEach(removeTarget);
        } else {
            hp -= damageValues[type] || 0;
            if (hp < 0) hp = 0;
        }

        hud.textContent = `HP: ${hp} | Score: ${score}`;
        if (hp <= 0) {
            gameover.style.display = "block";
        } else {
            ensureTargets();
        }
    }
}


camera.position.set(0, 0, 0);

function animate() {
    requestAnimationFrame(animate);

    const now = Date.now();
    for (let t of [...targets]) {
        if (t.userData.type !== "circle" && now - t.userData.spawnTime > 2000) {
            removeTarget(t);
        }
    }
    ensureTargets();

    renderer.render(scene, camera);
}
animate();

window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});


function restartGame() {
    hp = 100;
    score = 0;
    hud.textContent = `HP: ${hp} | Score: ${score}`;
    gameover.style.display = "none";

    for (let t of [...targets]) removeTarget(t);
    ensureTargets();

    renderer.domElement.requestPointerLock();
}

// Init
ensureTargets();
let scene, camera, renderer, car;
let roadSegments = [];
let speed = 0, maxSpeed = 1.4, acceleration = 0.006, deceleration = 0.012;
let distance = 0;
let isGameOver = false;
let targetCarRotationZ = 0;

const keys = { up: false, down: false, left: false, right: false };

init();
animate();

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xff9944);
    scene.fog = new THREE.FogExp2(0xff9944, 0.012);

    camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1000);

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    document.body.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffeedd, 0.8);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfffaee, 1.4);
    sunLight.position.set(60, 120, 40);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 300;
    const d = 30;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    scene.add(sunLight);

    const groundGeo = new THREE.PlaneGeometry(3000, 3000);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0xc28d51, roughness: 0.95 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.1;
    scene.add(ground);

    for (let i = 0; i < 18; i++) {
        createRoadSegment(-i * 40);
    }

    createCar();
    setupControls();
    window.addEventListener('resize', onWindowResize);
}

function createAsphaltTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#1c1c1c';
    ctx.fillRect(0, 0, 512, 512);

    for (let i = 0; i < 30000; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const shade = Math.floor(Math.random() * 50) + 20;
        ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
        ctx.fillRect(x, y, 2, 2);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 10);
    return texture;
}

function createRoadSegment(zPos) {
    const roadGroup = new THREE.Group();
    
    const roadGeo = new THREE.PlaneGeometry(16, 40);
    const roadMat = new THREE.MeshStandardMaterial({ 
        map: createAsphaltTexture(), 
        roughness: 0.7,
        metalness: 0.1 
    });
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.receiveShadow = true;
    roadGroup.add(road);

    for (let j = -18; j < 20; j += 6) {
        const lineGeo = new THREE.PlaneGeometry(0.3, 3);
        const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const line = new THREE.Mesh(lineGeo, lineMat);
        line.rotation.x = -Math.PI / 2;
        line.position.set(0, 0.02, j);
        roadGroup.add(line);
    }

    const railGeo = new THREE.BoxGeometry(0.4, 0.8, 40);
    const railMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8, roughness: 0.3 });
    
    const leftRail = new THREE.Mesh(railGeo, railMat);
    leftRail.position.set(-8.2, 0.4, 0);
    leftRail.castShadow = true;
    roadGroup.add(leftRail);

    const rightRail = new THREE.Mesh(railGeo, railMat);
    rightRail.position.set(8.2, 0.4, 0);
    rightRail.castShadow = true;
    roadGroup.add(rightRail);

    roadGroup.position.z = zPos;
    scene.add(roadGroup);
    roadSegments.push(roadGroup);
}

function createCar() {
    car = new THREE.Group();
    
    const mtlLoader = new THREE.MTLLoader();
    mtlLoader.load('sdxcar.mtl', function (materials) {
        materials.preload();
        
        for (let matName in materials.materials) {
            let mat = materials.materials[matName];
            mat.side = THREE.DoubleSide;
        }

        const objLoader = new THREE.OBJLoader();
        objLoader.setMaterials(materials);
        objLoader.load('sdxcar.obj', function (object) {
            object.traverse((child) => {
                if (child.isMesh) {
                    // Remove unwanted bottom shadow plane/glitch mesh if present in model
                    if (child.name.toLowerCase().includes('plane') || child.geometry.boundingSphere?.radius > 10) {
                        child.visible = false;
                        return;
                    }
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            // Proper Scaling and Centering for sdxcar.obj
            object.scale.set(0.85, 0.85, 0.85);

            const box = new THREE.Box3().setFromObject(object);
            const center = box.getCenter(new THREE.Vector3());
            object.position.sub(center);
            object.position.y += (box.max.y - box.min.y) / 2;

            // Ensure car faces straight forward correctly
            object.rotation.y = Math.PI;

            car.add(object);
        }, undefined, function (error) {
            console.error('Error loading sdxcar.obj:', error);
            fallbackBoxCar();
        });
    }, undefined, function (error) {
        console.error('Error loading sdxcar.mtl:', error);
        fallbackBoxCar();
    });

    car.position.set(0, 0, 0);
    scene.add(car);
}

function fallbackBoxCar() {
    const geo = new THREE.BoxGeometry(1.6, 0.8, 3.2);
    const mat = new THREE.MeshStandardMaterial({ color: 0x3366ff });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 0.4;
    mesh.castShadow = true;
    car.add(mesh);
}

function setupControls() {
    const bindButton = (id, keyName) => {
        const el = document.getElementById(id);
        if (!el) return;
        
        const pressOn = (e) => { e.preventDefault(); keys[keyName] = true; el.classList.add('active'); };
        const pressOff = (e) => { e.preventDefault(); keys[keyName] = false; el.classList.remove('active'); };

        el.addEventListener('mousedown', pressOn);
        el.addEventListener('mouseup', pressOff);
        el.addEventListener('mouseleave', pressOff);
        el.addEventListener('touchstart', pressOn, { passive: false });
        el.addEventListener('touchend', pressOff, { passive: false });
    };

    bindButton('btn-up', 'up');
    bindButton('btn-down', 'down');
    bindButton('btn-left', 'left');
    bindButton('btn-right', 'right');

    window.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp' || e.key === 'w') keys.up = true;
        if (e.key === 'ArrowDown' || e.key === 's') keys.down = true;
        if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = true;
        if (e.key === 'ArrowRight' || e.key === 'd') keys.right = true;
    });

    window.addEventListener('keyup', (e) => {
        if (e.key === 'ArrowUp' || e.key === 'w') keys.up = false;
        if (e.key === 'ArrowDown' || e.key === 's') keys.down = false;
        if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = false;
        if (e.key === 'ArrowRight' || e.key === 'd') keys.right = false;
    });
}

function animate() {
    if (isGameOver) return;

    requestAnimationFrame(animate);

    if (keys.up) {
        speed = Math.min(speed + acceleration, maxSpeed);
    } else if (keys.down) {
        speed = Math.max(speed - deceleration * 2, 0);
    } else {
        speed = Math.max(speed - deceleration, 0);
    }

    if (keys.left && car.position.x > -7) {
        car.position.x -= 0.18;
        targetCarRotationZ = 0.1;
    } else if (keys.right && car.position.x < 7) {
        car.position.x += 0.18;
        targetCarRotationZ = -0.1;
    } else {
        targetCarRotationZ = 0;
    }

    car.rotation.z = THREE.MathUtils.lerp(car.rotation.z, targetCarRotationZ, 0.15);

    if (speed > 0) {
        distance += Math.round(speed * 12);
        roadSegments.forEach(segment => {
            segment.position.z += speed;
        });

        roadSegments.forEach(segment => {
            if (segment.position.z > 20) {
                const furthestZ = Math.min(...roadSegments.map(s => s.position.z));
                segment.position.z = furthestZ - 40;
            }
        });
    }

    const targetFov = 65 + (speed * 8);
    camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, 0.1);
    camera.updateProjectionMatrix();

    // Camera closer to the car
    camera.position.x = car.position.x * 0.4;
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, car.position.y + 2.2, 0.1);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, car.position.z + 4.2, 0.1);
    camera.lookAt(car.position.x, car.position.y + 0.5, car.position.z - 2.0);

    const speedEl = document.getElementById('speed-val');
    const distEl = document.getElementById('dist-val');
    if (speedEl) speedEl.innerText = Math.round(speed * 140);
    if (distEl) distEl.innerText = distance;

    renderer.render(scene, camera);
}

function gameOver() {
    isGameOver = true;
    const finalDistEl = document.getElementById('final-dist');
    const gameOverEl = document.getElementById('game-over');
    if (finalDistEl) finalDistEl.innerText = distance;
    if (gameOverEl) gameOverEl.style.display = 'block';
}

function restartGame() {
    isGameOver = false;
    speed = 0;
    distance = 0;
    car.position.set(0, 0, 0);
    const gameOverEl = document.getElementById('game-over');
    if (gameOverEl) gameOverEl.style.display = 'none';
    animate();
}

function onWindowResize() {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

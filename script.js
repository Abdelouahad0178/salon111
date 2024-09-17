document.addEventListener('DOMContentLoaded', function () {
    init(); // Initialisation de la scène 3D après le chargement complet du DOM

    const applyTextureBtn = document.getElementById('applyTexture');
    const textureOptions = document.getElementById('textureOptions');
    const choosePaintBtn = document.getElementById('choosePaint');
    const chooseTileBtn = document.getElementById('chooseTile');
    const tileInput = document.getElementById('tileInput');
    const colorPicker = document.getElementById('colorPicker');
    const lightSlider = document.getElementById('lightSlider');
    const moveForwardBtn = document.getElementById('moveForward');
    const moveBackwardBtn = document.getElementById('moveBackward');

    // Afficher les options de texture lorsqu'on clique sur "Appliquer Texture"
    applyTextureBtn.addEventListener('click', () => {
        textureOptions.style.display = 'flex';
    });

    // Gestionnaire d'événement pour le bouton "Peinture"
    choosePaintBtn.addEventListener('click', () => {
        tileInput.style.display = 'none';
        colorPicker.style.display = 'inline-block';
        textureOptions.style.display = 'none'; // Cache les options après sélection
    });

    // Gestionnaire d'événement pour le bouton "Carrelage"
    chooseTileBtn.addEventListener('click', () => {
        colorPicker.style.display = 'none';
        tileInput.style.display = 'inline-block';
        textureOptions.style.display = 'none'; // Cache les options après sélection
    });

    // Appliquer la peinture sur tous les murs sauf le mur avant s'il est déjà carrelé
    colorPicker.addEventListener('input', () => {
        applyPaintToAllWalls(colorPicker.value);
    });

    // Importer une texture de carrelage pour l'appliquer manuellement soit au sol soit au mur avant selon la sélection
    tileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (e) {
                const texture = new THREE.TextureLoader().load(e.target.result);
                tileTexture = texture; // Stocke la texture pour une application manuelle via clic
            };
            reader.readAsDataURL(file);
        }
    });

    // Slider pour ajuster l'intensité de la lumière
    lightSlider.addEventListener('input', (event) => {
        updateLightIntensity(event.target.value);
    });

    lightSlider.style.display = 'inline-block'; // Affiche le slider dès le chargement

    // Avancer et reculer la caméra
    moveForwardBtn.addEventListener('click', () => moveCamera('forward'));
    moveBackwardBtn.addEventListener('click', () => moveCamera('backward'));

    // Écouteurs d'événements pour les interactions souris et tactiles
    renderer.domElement.addEventListener('click', onMouseClick, false);
    renderer.domElement.addEventListener('touchstart', onTouchStart, false);
});

let scene, camera, renderer, controls, transformControls;
let walls = [], floor;
let objects = [];
let directionalLight;
let tileTexture = null; // Stockage de la texture de carrelage pour une application par clic

function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true, canvas: document.getElementById('scene') });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    transformControls = new THREE.TransformControls(camera, renderer.domElement);
    scene.add(transformControls);

    createWalls();
    createFloor();

    camera.position.set(0, 1.5, 5);
    camera.lookAt(0, 1, 0);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    directionalLight = new THREE.DirectionalLight(0xffffff, 1); // Intensité par défaut à 1
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    window.addEventListener('resize', onWindowResize, false);

    animate();
}

function createWalls() {
    const wallGeometry = new THREE.PlaneGeometry(5, 3);

    for (let i = 0; i < 3; i++) {
        let wallMaterial = new THREE.MeshStandardMaterial({ color: 0x888888 });
        walls[i] = new THREE.Mesh(wallGeometry, wallMaterial);

        walls[i].position.set(i === 0 ? 0 : i === 1 ? -2.5 : 2.5, 1.5, i === 0 ? -2.5 : 0);
        walls[i].rotation.y = i === 1 ? Math.PI / 2 : i === 2 ? -Math.PI / 2 : 0;
        walls[i].userData.type = `wall${i + 1}`;

        scene.add(walls[i]);
        objects.push(walls[i]);
    }
}

function createFloor() {
    const floorGeometry = new THREE.PlaneGeometry(5, 5);
    const floorMaterial = new THREE.MeshStandardMaterial({
        color: 0xcccccc,
        side: THREE.DoubleSide,
        wireframe: false,
        map: null
    });

    floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.userData.type = 'floor';
    scene.add(floor);
    objects.push(floor);
}

function applyTileToWall(texture, wallIndex) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;

    const wall = walls[wallIndex];
    if (wallIndex === 0) {
        wall.material.map = texture;
        wall.material.color.set(0xffffff);
        wall.material.needsUpdate = true;
        console.log(`Carrelage appliqué sur le mur avant.`);
    } else {
        alert('Le carrelage ne peut pas être appliqué sur ce mur.');
    }
}

function applyTileToFloor(texture) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;

    const floorWidth = floor.geometry.parameters.width;
    const floorHeight = floor.geometry.parameters.height;
    const textureAspectRatio = texture.image.width / texture.image.height;
    const desiredTilesAcross = 5;

    const repeatX = desiredTilesAcross;
    const repeatY = desiredTilesAcross / textureAspectRatio * (floorHeight / floorWidth);

    texture.repeat.set(repeatX, repeatY);
    texture.center.set(0.5, 0.5);

    floor.material.map = texture;
    floor.material.needsUpdate = true;

    console.log(`Carrelage appliqué au sol avec ${repeatX.toFixed(2)}x${repeatY.toFixed(2)} répétitions.`);
}

function applyPaintToAllWalls(color) {
    walls.forEach((wall, index) => {
        if (index !== 0 || !wall.material.map) {
            wall.material.color.set(color);
            wall.material.needsUpdate = true;
            console.log(`Peinture appliquée au mur ${index + 1}`);
        }
    });
}

function updateLightIntensity(value) {
    directionalLight.intensity = parseFloat(value);
    console.log('Intensité de la lumière ajustée à', value);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onMouseClick(event) {
    handleInteraction(event.clientX, event.clientY);
}

function onTouchStart(event) {
    if (event.touches.length === 1) {
        handleInteraction(event.touches[0].clientX, event.touches[0].clientY);
    }
}

function handleInteraction(x, y) {
    const mouse = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();

    mouse.x = (x / renderer.domElement.clientWidth) * 2 - 1;
    mouse.y = -(y / renderer.domElement.clientHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(objects, true);

    if (intersects.length > 0) {
        const clickedObject = intersects[0].object;

        if (clickedObject === floor && tileTexture) {
            applyTileToFloor(tileTexture);
        }

        if (clickedObject === walls[0] && tileTexture) {
            if (!walls[0].material.color.equals(new THREE.Color(0xffffff))) {
                applyTileToWall(tileTexture, 0);
            } else {
                alert('Impossible d’appliquer le carrelage sur le mur avant déjà peint.');
            }
        }
    }
}

function moveCamera(direction) {
    const moveStep = 0.5;
    if (direction === 'forward') {
        camera.position.z -= moveStep;
    } else if (direction === 'backward') {
        camera.position.z += moveStep;
    }
    camera.updateProjectionMatrix();
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

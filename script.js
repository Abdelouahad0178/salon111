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
                const loader = new THREE.TextureLoader();
                loader.load(
                    e.target.result,
                    function (texture) {
                        texture.encoding = THREE.sRGBEncoding;
                        texture.wrapS = THREE.RepeatWrapping;
                        texture.wrapT = THREE.RepeatWrapping;
                        texture.minFilter = THREE.LinearFilter;
                        texture.magFilter = THREE.LinearFilter;
                        tileTexture = texture; // Stocke la texture pour une application manuelle via clic
                        console.log('Texture chargée et prête à être appliquée.');
                    },
                    undefined,
                    function (error) {
                        console.error('Erreur de chargement de la texture :', error);
                    }
                );
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
let lastClickTime = 0; // Utilisé pour détecter les doubles clics
let isTextureFlipped = false; // État pour savoir si la texture est inversée ou non

function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true, canvas: document.getElementById('scene') });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputEncoding = THREE.sRGBEncoding; // Assurez-vous que le rendu prend en compte l'encodage des textures

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
    const wallTexture = texture.clone();
    wallTexture.wrapS = THREE.RepeatWrapping;
    wallTexture.wrapT = THREE.RepeatWrapping;
    wallTexture.needsUpdate = true; // Forcer la mise à jour de la texture

    const wall = walls[wallIndex];
    wall.material.map = wallTexture;
    wall.material.color.set(0xffffff);
    wall.material.needsUpdate = true; // Forcer la mise à jour du matériau
    wall.position.y = 1.5;
    console.log(`Carrelage appliqué sur le mur ${wallIndex + 1}.`);
}

function applyTileToFloor(texture) {
    const floorTexture = texture.clone();
    floorTexture.wrapS = THREE.RepeatWrapping;
    floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.needsUpdate = true; // Forcer la mise à jour de la texture

    const floorWidth = floor.geometry.parameters.width;
    const floorHeight = floor.geometry.parameters.height;
    const textureAspectRatio = floorTexture.image.width / floorTexture.image.height;
    const desiredTilesAcross = 5;

    const repeatX = desiredTilesAcross;
    const repeatY = desiredTilesAcross / textureAspectRatio * (floorHeight / floorWidth);

    floorTexture.repeat.set(repeatX, repeatY);
    floorTexture.center.set(0.5, 0.5);

    floor.material.map = floorTexture;
    floor.material.needsUpdate = true; // Forcer la mise à jour du matériau

    console.log(`Carrelage appliqué au sol avec ${repeatX.toFixed(2)}x${repeatY.toFixed(2)} répétitions.`);
}

function changeFloorTextureOrientation() {
    if (floor.material.map) {
        // Basculer l'état d'orientation
        isTextureFlipped = !isTextureFlipped;

        // Définir les nouvelles valeurs de répétition selon l'état d'orientation
        const newTexture = floor.material.map.clone();
        const repeatX = isTextureFlipped ? newTexture.repeat.y : newTexture.repeat.x;
        const repeatY = isTextureFlipped ? newTexture.repeat.x : newTexture.repeat.y;

        // Appliquer les répétitions basculées
        newTexture.repeat.set(repeatX, repeatY);
        newTexture.wrapS = THREE.RepeatWrapping;
        newTexture.wrapT = THREE.RepeatWrapping;
        newTexture.needsUpdate = true;

        // Recréer le matériau pour forcer la mise à jour
        const newMaterial = new THREE.MeshStandardMaterial({
            map: newTexture,
            color: 0xffffff,
            side: THREE.DoubleSide,
        });

        // Supprimer l'ancien sol et créer un nouveau Mesh pour forcer la mise à jour
        scene.remove(floor);
        floor = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), newMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.userData.type = 'floor';
        scene.add(floor);

        console.log(`Orientation de la texture du sol modifiée. Nouvelle orientation: ${isTextureFlipped ? 'Inversée' : 'Normale'}`);

        // Forcer le rendu pour visualiser le changement immédiatement
        renderer.clear(); // Efface le rendu précédent
        renderer.render(scene, camera);
    }
}

function applyPaintToAllWalls(color) {
    walls.forEach((wall, index) => {
        if (!wall.material.map) {
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
    const currentTime = Date.now();
    if (currentTime - lastClickTime < 300) { // Vérifie si le double clic est dans un intervalle de 300ms
        handleDoubleClick(event.clientX, event.clientY);
    }
    lastClickTime = currentTime;
    handleInteraction(event.clientX, event.clientY);
}

function onTouchStart(event) {
    const currentTime = Date.now();
    if (event.touches.length === 1) { // Un seul doigt touche l'écran
        if (currentTime - lastClickTime < 300) { // Vérifie si le double tap est dans un intervalle de 300ms
            handleDoubleClick(event.touches[0].clientX, event.touches[0].clientY);
        }
        lastClickTime = currentTime;
        handleInteraction(event.touches[0].clientX, event.touches[0].clientY);
    }
}

function handleDoubleClick(x, y) {
    const mouse = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();

    mouse.x = (x / renderer.domElement.clientWidth) * 2 - 1;
    mouse.y = -(y / renderer.domElement.clientHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(objects, true);

    if (intersects.length > 0) {
        const clickedObject = intersects[0].object;

        // Si le sol est cliqué deux fois, changer l'orientation de la texture
        if (clickedObject === floor) {
            changeFloorTextureOrientation();
        }
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

        // Appliquer le carrelage uniquement sur le sol ou le mur avant selon la sélection manuelle
        if (clickedObject === floor && tileTexture) {
            applyTileToFloor(tileTexture); // Applique le carrelage au sol
        }

        if (clickedObject === walls[0] && tileTexture) {
            // Appliquer le carrelage sur le mur avant sans restriction de peinture
            applyTileToWall(tileTexture, 0); // Applique le carrelage au mur avant par clic
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

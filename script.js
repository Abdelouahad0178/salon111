document.addEventListener('DOMContentLoaded', function () {
    init(); // Initialisation de la scène 3D après le chargement complet du DOM

    const applyTextureBtn = document.getElementById('applyTexture');
    const textureOptions = document.getElementById('textureOptions');
    const choosePaintBtn = document.getElementById('choosePaint');
    const chooseTileBtn = document.getElementById('chooseTile');
    const tileInput = document.getElementById('tileInput');
    const colorPicker = document.getElementById('colorPicker');
    const backgroundColorPicker = document.getElementById('backgroundColorPicker');
    const lightSlider = document.getElementById('lightSlider');
    const redoBtn = document.getElementById('redo');
    const undoBtn = document.getElementById('undo');
    const saveImageBtn = document.getElementById('saveImage');
    const resetSceneBtn = document.getElementById('resetScene');

    const normalTilePoseBtn = document.getElementById('normalTilePose');
    const offsetTilePoseBtn = document.getElementById('offsetTilePose');

    const floorTileWidthInput = document.getElementById('floorTileWidth');
    const floorTileHeightInput = document.getElementById('floorTileHeight');
    const wall1TileWidthInput = document.getElementById('wall1TileWidth');
    const wall1TileHeightInput = document.getElementById('wall1TileHeight');

    // Nouveau bouton toggle pour le menu
    const toggleMenuBtn = document.getElementById('toggleMenu');
    const controlsPanel = document.querySelector('.controls');

    // Désactiver les boutons de pose au démarrage
    normalTilePoseBtn.disabled = true;
    offsetTilePoseBtn.disabled = true;

    // Afficher les options de texture lorsqu'on clique sur "Appliquer Texture"
    applyTextureBtn.addEventListener('click', () => {
        textureOptions.style.display = 'flex';
    });

    // Gestionnaire d'événement pour le bouton "Peinture"
    choosePaintBtn.addEventListener('click', () => {
        tileInput.style.display = 'none';
        colorPicker.style.display = 'inline-block';
        textureOptions.style.display = 'none';
    });

    // Gestionnaire d'événement pour le bouton "Carrelage"
    chooseTileBtn.addEventListener('click', () => {
        colorPicker.style.display = 'none';
        tileInput.style.display = 'inline-block';
        textureOptions.style.display = 'none';
    });

    // Importer une texture de carrelage
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

                        tileTexture = texture;
                        wall1TileTexture = texture.clone();
                        console.log('Texture chargée et prête à être appliquée. Sélectionnez une partie à cliquer.');

                        normalTilePoseBtn.disabled = false;
                        offsetTilePoseBtn.disabled = false;
                    },
                    undefined,
                    function (error) {
                        console.error('Erreur de chargement de la texture :', error);
                    }
                );
            };

            reader.readAsDataURL(file);
        } else {
            console.error("Aucun fichier sélectionné.");
        }
    });

    // Gestionnaire d'événements pour le sélecteur de couleur
    colorPicker.addEventListener('input', (event) => {
        const color = event.target.value;
        applyPaintToAllWalls(color);
    });

    // Gestionnaire d'événements pour le sélecteur de couleur d'arrière-plan
    backgroundColorPicker.addEventListener('input', (event) => {
        const color = event.target.value;
        changeBackgroundColor(color);
    });

    // Slider pour ajuster l'intensité de la lumière
    lightSlider.addEventListener('input', (event) => {
        updateLightIntensity(event.target.value);
    });

    // Remplacer les actions pour "Défaire" et "Refaire"
    undoBtn.addEventListener('click', () => undoAction());
    redoBtn.addEventListener('click', () => redoAction());

    // Gestion des boutons de sauvegarde et de réinitialisation
    saveImageBtn.addEventListener('click', () => saveImage());
    resetSceneBtn.addEventListener('click', () => resetScene());

    // Écouteurs d'événements pour les interactions souris et tactiles
    renderer.domElement.addEventListener('click', onMouseClick, false);
    renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: true });

    // Fonction pour mettre à jour la valeur affichée
    function updateValue(sliderId, valueId) {
        const slider = document.getElementById(sliderId);
        const valueSpan = document.getElementById(valueId);
        
        slider.addEventListener('input', function() {
            valueSpan.textContent = parseFloat(this.value).toFixed(1);
            
            if (sliderId.includes('floor')) {
                adjustFloorTileDimensions();
            } else if (sliderId.includes('wall1')) {
                adjustWall1TileDimensions();
            }
        });
    }

    // Mettre à jour les valeurs pour chaque slider
    updateValue('floorTileWidth', 'floorTileWidthValue');
    updateValue('floorTileHeight', 'floorTileHeightValue');
    updateValue('wall1TileWidth', 'wall1TileWidthValue');
    updateValue('wall1TileHeight', 'wall1TileHeightValue');

    // Gestion des types de pose de carrelage au sol et au mur1
    normalTilePoseBtn.addEventListener('click', () => {
        if (tileTexture) {
            applyTileToFloor(tileTexture, false);
            saveAction('applyTileToFloor', tileTexture, false);
            applyTileToWall1(wall1TileTexture, false);
            saveAction('applyTileToWall1', wall1TileTexture, false);
        } else {
            console.error('La texture doit être chargée avant d\'appliquer la pose.');
        }
    });

    offsetTilePoseBtn.addEventListener('click', () => {
        if (tileTexture) {
            applyTileToFloor(tileTexture, true);
            saveAction('applyTileToFloor', tileTexture, true);
            applyTileToWall1(wall1TileTexture, true);
            saveAction('applyTileToWall1', wall1TileTexture, true);
        } else {
            console.error('La texture doit être chargée avant d\'appliquer la pose.');
        }
    });

    // Nouveau gestionnaire d'événements pour le bouton toggle du menu
    toggleMenuBtn.addEventListener('click', function() {
        controlsPanel.classList.toggle('hidden');
        toggleMenuBtn.textContent = controlsPanel.classList.contains('hidden') ? '☰' : '✕';
    });
});

let scene, camera, renderer, controls, transformControls;
let walls = [], floor;
let objects = [];
let directionalLight;
let tileTexture = null;
let wall1TileTexture = null;
let lastClickTime = 0;
let isTileRotated = false;
let isWall1TileRotated = false;

let actionHistory = [];
let redoStack = [];

let floorTileWidth = 60;
let floorTileHeight = 60;
let wall1TileWidth = 60;
let wall1TileHeight = 120;

function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true, canvas: document.getElementById('scene') });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputEncoding = THREE.sRGBEncoding;

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

    directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    window.addEventListener('resize', onWindowResize, false);

    scene.background = new THREE.Color(0xffffff);

    animate();
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
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
    const floorWidth = 5;
    const floorDepth = 5;
    const floorGeometry = new THREE.PlaneGeometry(floorWidth, floorDepth);
    const floorMaterial = new THREE.MeshStandardMaterial({
        color: 0x787373,
        side: THREE.DoubleSide,
        wireframe: false,
        map: null
    });

    floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.userData.type = 'floor';
    scene.add(floor);
    objects.push(floor);

    console.log(`Sol créé avec une surface de ${floorWidth}x${floorDepth} mètres`);
}

function applyTileToFloor(texture, isOffset) {
    if (!texture) {
        console.error("Texture non valide ou non chargée correctement.");
        return;
    }

    const floorTexture = texture.clone();
    floorTexture.wrapS = THREE.RepeatWrapping;
    floorTexture.wrapT = THREE.RepeatWrapping;

    const floorWidth = 5;
    const floorDepth = 5;

    const repeatX = floorWidth / (floorTileWidth / 100);
    const repeatY = floorDepth / (floorTileHeight / 100);

    floorTexture.repeat.set(repeatX, repeatY);

    if (isOffset) {
        floorTexture.offset.x = 0.5 / repeatX;
    } else {
        floorTexture.offset.set(0, 0);
    }

    floorTexture.center.set(0.5, 0.5);
    floorTexture.needsUpdate = true;

    floor.material.map = floorTexture;
    floor.material.needsUpdate = true;

    console.log(`Carrelage appliqué au sol de ${floorWidth}x${floorDepth} mètres avec ${repeatX.toFixed(2)}x${repeatY.toFixed(2)} répétitions. Pose ${isOffset ? 'décalée' : 'normale'}.`);
}

function applyTileToWall1(texture, isOffset) {
    if (!texture) {
        console.error("Texture non valide ou non chargée correctement pour le mur1.");
        return;
    }

    const wall1Texture = texture.clone();
    wall1Texture.wrapS = THREE.RepeatWrapping;
    wall1Texture.wrapT = THREE.RepeatWrapping;

    const wallWidth = 5;
    const wallHeight = 3;

    const repeatX = wallWidth / (wall1TileWidth / 100);
    const repeatY = wallHeight / (wall1TileHeight / 100);

    wall1Texture.repeat.set(repeatX, repeatY);

    if (isOffset) {
        wall1Texture.offset.y = 0.5 / repeatY;
    } else {
        wall1Texture.offset.set(0, 0);
    }

    wall1Texture.center.set(0.5, 0.5);
    wall1Texture.needsUpdate = true;

    walls[0].material.map = wall1Texture;
    walls[0].material.color.set(0xffffff); // Réinitialiser la couleur à blanc
    walls[0].material.needsUpdate = true;

    console.log(`Carrelage appliqué au mur1 de ${wallWidth}x${wallHeight} mètres avec ${repeatX.toFixed(2)}x${repeatY.toFixed(2)} répétitions. Pose ${isOffset ? 'décalée' : 'normale'}.`);
}

function adjustFloorTileDimensions() {
    floorTileWidth = parseFloat(document.getElementById('floorTileWidth').value);
    floorTileHeight = parseFloat(document.getElementById('floorTileHeight').value);
    if (floor.material.map) {
        applyTileToFloor(floor.material.map, floor.material.map.offset.x !== 0);
    }
}

function adjustWall1TileDimensions() {
    wall1TileWidth = parseFloat(document.getElementById('wall1TileWidth').value);
    wall1TileHeight = parseFloat(document.getElementById('wall1TileHeight').value);
    if (walls[0].material.map) {
        applyTileToWall1(walls[0].material.map, walls[0].material.map.offset.y !== 0);
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

        if (clickedObject === floor) {
            toggleFloorTextureOrientation();
        } else if (clickedObject === walls[0]) {
            toggleWall1TextureOrientation();
        }
    }
}

function toggleFloorTextureOrientation() {
    if (floor.material.map) {
        const texture = floor.material.map;

        if (isTileRotated) {
            texture.rotation = 0;
            console.log('Tuiles du sol réinitialisées à l\'orientation normale.');
        } else {
            texture.rotation = Math.PI / 2;
            console.log('Tuiles du sol tournées de 90 degrés.');
        }

        texture.needsUpdate = true;
        floor.material.needsUpdate = true;

        isTileRotated = !isTileRotated;
    }
}

function toggleWall1TextureOrientation() {
    if (walls[0].material.map) {
        const texture = walls[0].material.map;

        if (isWall1TileRotated) {
            texture.rotation = 0;
            console.log('Tuiles du mur1 réinitialisées à l\'orientation normale.');
        } else {
            texture.rotation = Math.PI / 2;
            console.log('Tuiles du mur1 tournées de 90 degrés.');
        }

        texture.needsUpdate = true;
        walls[0].material.needsUpdate = true;

        isWall1TileRotated = !isWall1TileRotated;
    }
}

function onMouseClick(event) {
    const currentTime = Date.now();
    if (currentTime - lastClickTime < 300) {
        handleDoubleClick(event.clientX, event.clientY);
    } else {
        handleInteraction(event.clientX, event.clientY);
    }
    lastClickTime = currentTime;
}

function onTouchStart(event) {
    const currentTime = Date.now();
    if (event.touches.length === 1) {
        if (currentTime - lastClickTime < 300) {
            handleDoubleClick(event.touches[0].clientX, event.touches[0].clientY);
        } else {
            handleInteraction(event.touches[0].clientX, event.touches[0].clientY);
        }
        lastClickTime = currentTime;
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
            applyTileToFloor(tileTexture, false);
            saveAction('applyTileToFloor', tileTexture, false);
        } else if (clickedObject === walls[0] && wall1TileTexture) {
            applyTileToWall1(wall1TileTexture, false);
            saveAction('applyTileToWall1', wall1TileTexture, false);
        } else {
            console.log('Aucune surface valide cliquée ou aucune texture chargée.');
        }
    }
}

function saveAction(action, texture, param) {
    actionHistory.push({ action, texture, param });
    redoStack = [];  // Vider le redoStack dès qu'une nouvelle action est faite
}

function undoAction() {
    if (actionHistory.length > 0) {
        const lastAction = actionHistory.pop();
        redoStack.push(lastAction);
        
        if (lastAction.action === 'applyPaintToAllWalls') {
            walls.forEach((wall, index) => {
                if (index === 0 && wall.material.map) {
                    // Ne pas modifier le mur1 s'il est carrelé
                    return;
                }
                wall.material.color.set(0x888888);
                wall.material.map = null;
                wall.material.needsUpdate = true;
            });
        } else if (lastAction.action === 'applyTileToFloor') {
            floor.material.map = null;
            floor.material.needsUpdate = true;
        } else if (lastAction.action === 'applyTileToWall1') {
            walls[0].material.map = null;
            walls[0].material.color.set(0x888888);
            walls[0].material.needsUpdate = true;
        } else if (lastAction.action === 'changeBackgroundColor') {
            scene.background = new THREE.Color(0xffffff); // Couleur par défaut
            document.getElementById('backgroundColorPicker').value = "#ffffff";
        }
        
        console.log('Action défaite.');
    } else {
        console.log('Aucune action à défaire.');
    }
}

function redoAction() {
    if (redoStack.length > 0) {
        const actionToRedo = redoStack.pop();
        actionHistory.push(actionToRedo);
        
        if (actionToRedo.action === 'applyPaintToAllWalls') {
            applyPaintToAllWalls(actionToRedo.texture);
        } else if (actionToRedo.action === 'applyTileToFloor') {
            applyTileToFloor(actionToRedo.texture, actionToRedo.param);
        } else if (actionToRedo.action === 'applyTileToWall1') {
            applyTileToWall1(actionToRedo.texture, actionToRedo.param);
        } else if (actionToRedo.action === 'changeBackgroundColor') {
            changeBackgroundColor(actionToRedo.texture);
        }
        
        console.log('Action refaite.');
    } else {
        console.log('Aucune action à refaire.');
    }
}

function saveImage() {
    renderer.render(scene, camera);
    const image = renderer.domElement.toDataURL("image/png");
    const link = document.createElement('a');
    link.href = image;
    link.download = 'scene.png';
    link.click();
    console.log('Image sauvegardée.');
}

function resetScene() {
    floor.material.map = null;
    floor.material.color.set(0xcccccc);
    floor.material.needsUpdate = true;

    walls.forEach(wall => {
        wall.material.map = null;
        wall.material.color.set(0x888888);
        wall.material.needsUpdate = true;
    });

    scene.background = new THREE.Color(0xffffff);
    document.getElementById('backgroundColorPicker').value = "#ffffff";

    actionHistory = [];
    redoStack = [];
    console.log('Scène réinitialisée.');
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

function updateLightIntensity(value) {
    directionalLight.intensity = parseFloat(value);
    console.log('Intensité de la lumière ajustée à', value);
}

function applyPaintToAllWalls(color) {
    walls.forEach((wall, index) => {
        if (index === 0 && wall.material.map) {
            console.log('Le mur1 est carrelé. La peinture ne sera pas appliquée.');
            return;
        }
        
        // Appliquer la nouvelle couleur
        wall.material.color.set(color);
        wall.material.map = null; // Supprimer toute texture existante
        wall.material.needsUpdate = true;
        
        console.log(`Peinture appliquée au mur ${index + 1}`);
    });

    // Sauvegarder l'action dans l'historique
    saveAction('applyPaintToAllWalls', color);
}

function changeBackgroundColor(color) {
    scene.background = new THREE.Color(color);
    console.log(`Couleur d'arrière-plan changée à ${color}`);
    
    // Sauvegarder l'action dans l'historique
    saveAction('changeBackgroundColor', color);
}





  document.addEventListener('contextmenu', function(e) {
    e.preventDefault();
  });









// Assurez-vous d'appeler init() quelque part dans votre code pour initialiser la scène
// init();
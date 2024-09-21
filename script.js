document.addEventListener('DOMContentLoaded', function () {
    init(); // Initialisation de la scène 3D après le chargement complet du DOM

    const applyTextureBtn = document.getElementById('applyTexture');
    const textureOptions = document.getElementById('textureOptions');
    const choosePaintBtn = document.getElementById('choosePaint');
    const chooseTileBtn = document.getElementById('chooseTile');
    const tileInput = document.getElementById('tileInput');
    const colorPicker = document.getElementById('colorPicker');
    const lightSlider = document.getElementById('lightSlider');
    const redoBtn = document.getElementById('redo');
    const undoBtn = document.getElementById('undo');
    const saveImageBtn = document.getElementById('saveImage');
    const resetSceneBtn = document.getElementById('resetScene');

    const tileWidthInput = document.getElementById('tileWidth');
    const tileHeightInput = document.getElementById('tileHeight');

    const tileWidthValue = document.getElementById('tileWidthValue');
    const tileHeightValue = document.getElementById('tileHeightValue');

    const normalTilePoseBtn = document.getElementById('normalTilePose');
    const offsetTilePoseBtn = document.getElementById('offsetTilePose');

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

    // Slider pour ajuster l'intensité de la lumière
    lightSlider.addEventListener('input', (event) => {
        updateLightIntensity(event.target.value);
    });

    lightSlider.style.display = 'inline-block';

    // Remplacer les actions pour "Défaire" et "Refaire"
    undoBtn.addEventListener('click', () => undoAction());
    redoBtn.addEventListener('click', () => redoAction());

    // Gestion des boutons de sauvegarde et de réinitialisation
    saveImageBtn.addEventListener('click', () => saveImage());
    resetSceneBtn.addEventListener('click', () => resetScene());

    // Écouteurs d'événements pour les interactions souris et tactiles
    renderer.domElement.addEventListener('click', onMouseClick, false);
    renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: true });

    // Ajuster la largeur et la hauteur des carreaux
    tileWidthInput.addEventListener('input', () => {
        adjustTileDimensions();
        tileWidthValue.textContent = `${(tileWidthInput.value * 10).toFixed(0)} `;
    });

    tileHeightInput.addEventListener('input', () => {
        adjustTileDimensions();
        tileHeightValue.textContent = `${(tileHeightInput.value * 10).toFixed(0)} `;
    });

    // Gestion des types de pose de carrelage au sol
    normalTilePoseBtn.addEventListener('click', () => {
        if (tileTexture) {
            applyTileToFloor(tileTexture, false);
            saveAction('applyTileToFloor', tileTexture, false);
        } else {
            console.error('La texture doit être chargée avant d\'appliquer la pose.');
        }
    });

    offsetTilePoseBtn.addEventListener('click', () => {
        if (tileTexture) {
            applyTileToFloor(tileTexture, true);
            saveAction('applyTileToFloor', tileTexture, true);
        } else {
            console.error('La texture doit être chargée avant d\'appliquer la pose.');
        }
    });
});

let scene, camera, renderer, controls, transformControls;
let walls = [], floor;
let objects = [];
let directionalLight;
let tileTexture = null;
let lastClickTime = 0;
let originalTextureRepeat = new THREE.Vector2(1, 1);
let tileAspectRatio = 1;
let isTileRotated = false;

let actionHistory = [];
let redoStack = [];

// Initialisation de la scène 3D
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

// Fonction pour appliquer la texture sur le sol tout en respectant les dimensions des sliders
function applyTileToFloor(texture, isOffset) {
    if (!texture) {
        console.error("Texture non valide ou non chargée correctement.");
        return;
    }

    const floorTexture = texture.clone();
    floorTexture.wrapS = THREE.RepeatWrapping;
    floorTexture.wrapT = THREE.RepeatWrapping;

    const tileWidthValue = document.getElementById('tileWidth').value;
    const tileHeightValue = document.getElementById('tileHeight').value;

    // Utiliser les valeurs des sliders pour ajuster la répétition de la texture
    const repeatX = 10 / tileWidthValue; // Ajuster la répétition en fonction de la largeur
    const repeatY = 10 / tileHeightValue; // Ajuster la répétition en fonction de la hauteur

    floorTexture.repeat.set(repeatX, repeatY); // Appliquer les répétitions
    floorTexture.needsUpdate = true;

    if (isOffset) {
        floorTexture.onUpdate = function () {
            for (let row = 0; row < repeatY; row++) {
                if (row % 2 === 1) {
                    floorTexture.offset.x = 0.5 / repeatX;
                } else {
                    floorTexture.offset.x = 0;
                }
                floorTexture.needsUpdate = true;
            }
        };
    } else {
        floorTexture.offset.set(0, 0);
    }

    floor.material.map = floorTexture;
    floor.material.needsUpdate = true;

    console.log(`Carrelage appliqué au sol avec ${repeatX.toFixed(2)}x${repeatY.toFixed(2)} répétitions. Pose ${isOffset ? 'décalée' : 'normale'}.`);
}

// Fonction pour appliquer la texture sur le mur avant
function applyTileToWall(texture, wallIndex) {
    if (!texture) {
        console.error("Texture non valide ou non chargée correctement.");
        return;
    }

    const wallTexture = texture.clone();
    wallTexture.wrapS = THREE.RepeatWrapping;
    wallTexture.wrapT = THREE.RepeatWrapping;

    const tileWidthValue = document.getElementById('tileWidth').value;
    const tileHeightValue = document.getElementById('tileHeight').value;

    // Utiliser les valeurs des sliders pour ajuster la répétition de la texture
    const repeatX = 10 / tileWidthValue; 
    const repeatY = 10 / tileHeightValue; 

    wallTexture.repeat.set(repeatX, repeatY);
    wallTexture.needsUpdate = true;

    const wall = walls[wallIndex];
    wall.material.map = wallTexture;
    wall.material.color.set(0xffffff);
    wall.material.needsUpdate = true;

    console.log(`Carrelage appliqué sur le mur ${wallIndex + 1} avec ${repeatX.toFixed(2)}x${repeatY.toFixed(2)} répétitions.`);
}

// Ajuster les dimensions des carreaux en fonction des sliders
function adjustTileDimensions() {
    if (floor.material.map) {
        const texture = floor.material.map;
        const widthValue = document.getElementById('tileWidth').value;
        const heightValue = document.getElementById('tileHeight').value;

        // Ajuster la répétition de la texture du sol en fonction des sliders
        texture.repeat.set(10 / widthValue, 10 / heightValue);
        texture.needsUpdate = true;
        floor.material.needsUpdate = true;

        console.log(`Dimensions des carreaux ajustées : Largeur = ${widthValue}, Hauteur = ${heightValue}`);
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
        }
    }
}

function toggleFloorTextureOrientation() {
    if (floor.material.map) {
        const texture = floor.material.map;

        if (isTileRotated) {
            texture.rotation = 0;
            console.log('Tuiles réinitialisées à l\'orientation normale.');
        } else {
            texture.rotation = Math.PI / 2;
            console.log('Tuiles tournées de 90 degrés.');
        }

        texture.needsUpdate = true;
        floor.material.needsUpdate = true;

        isTileRotated = !isTileRotated;
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
        } else if (clickedObject === walls[0] && tileTexture) {
            applyTileToWall(tileTexture, 0); // Appliquer au mur avant (index 0)
            saveAction('applyTileToWall', tileTexture, 0);
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
            // Réinitialiser les murs à leur état par défaut
            walls.forEach((wall) => {
                wall.material.color.set(0x888888); // Couleur grise par défaut
                wall.material.map = null;
                wall.material.needsUpdate = true;
            });
        } else if (lastAction.action === 'applyTileToFloor') {
            // Réinitialiser le sol sans texture
            floor.material.map = null;
            floor.material.needsUpdate = true;
        } else if (lastAction.action === 'applyTileToWall') {
            // Réinitialiser le mur avant sans texture
            walls[0].material.map = null;
            walls[0].material.needsUpdate = true;
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
            applyPaintToAllWalls(actionToRedo.texture); // 'texture' contient la couleur dans ce cas
        } else if (actionToRedo.action === 'applyTileToFloor') {
            applyTileToFloor(actionToRedo.texture, actionToRedo.param);
        } else if (actionToRedo.action === 'applyTileToWall') {
            applyTileToWall(actionToRedo.texture, actionToRedo.param);
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
    // Réinitialiser le sol et les murs sans texture
    floor.material.map = null;
    floor.material.color.set(0xcccccc);
    floor.material.needsUpdate = true;

    walls.forEach(wall => {
        wall.material.map = null;
        wall.material.color.set(0x888888);
        wall.material.needsUpdate = true;
    });

    // Réinitialiser l'historique des actions
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
        if (wall.material.map && index !== 0) {
            wall.material.map = null;
        }

        wall.material.color.set(color);
        wall.material.needsUpdate = true;

        console.log(`Peinture appliquée au mur ${index + 1}`);
    });

    saveAction('applyPaintToAllWalls', color);
}

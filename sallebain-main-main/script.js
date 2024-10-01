// Variables globales
let scene, camera, renderer, controls, transformControls;
let walls = [], floor;
let objects = [];
let selectedObject = null;
let selectedWall = null;
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let gltfLoader = new THREE.GLTFLoader();
let objLoader = new THREE.OBJLoader();
let fbxLoader = new THREE.FBXLoader();
let sinkModel = null;
let mirrorModel = null;
let bidetModel = null;
let actionHistory = [];
let redoStack = [];
let selectedTexture = null;
let texture1 = null, texture2 = null;
let isDoubleTile = false;
let firstTileSelected = false;
let importAuthorized = false;

// Dimensions initiales des carreaux en mètres
let defaultTileWidth = 0.6;
let defaultTileHeight = 1.2;
let currentTileWidth = defaultTileWidth;
let currentTileHeight = defaultTileHeight;
let selectedOrientation = 'horizontal';

// Variables pour la détection de clics multiples
let clickCount = 0;
let clickTimeout;

document.addEventListener('DOMContentLoaded', function () {
    init();
    addEventListeners();
    loadTexturesFromJson();
});

function init() {
    initScene();
    initCamera();
    initRenderer();
    initControls();
    createWalls();
    createFloor();
    initLights();
    animate();
}
function initScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xFFFFFF); // Modifiez ce code couleur pour personnaliser l'arrière-plan
}


function initCamera() {
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 2, 6);
    camera.lookAt(0, 1.5, 0);
}

function initRenderer() {
    renderer = new THREE.WebGLRenderer({ antialias: true, canvas: document.getElementById('scene') });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
}

function initControls() {
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.screenSpacePanning = false;
    controls.minDistance = 1;
    controls.maxDistance = 15;
    controls.maxPolarAngle = Math.PI / 2;

    transformControls = new THREE.TransformControls(camera, renderer.domElement);
    scene.add(transformControls);

    transformControls.addEventListener('dragging-changed', function (event) {
        controls.enabled = !event.value;
    });
}
function createWalls() {
    const wallWidth = 5;
    const wallHeight = 3;
    const wallThickness = 0.2;
    const wallGeometry = new THREE.BoxGeometry(wallWidth, wallHeight, wallThickness);
    const wallColor = 0xf4f4f9;

    for (let i = 0; i < 2; i++) {
        const wallMaterial = new THREE.MeshStandardMaterial({ color: wallColor });
        walls[i] = new THREE.Mesh(wallGeometry, wallMaterial);
        walls[i].userData.isHorizontal = (selectedOrientation === 'horizontal');

        if (i === 0) {
            walls[i].position.set(0, wallHeight / 2, -wallWidth / 2 - wallThickness / 2);
        } else {
            walls[i].position.set(-wallWidth / 2 - wallThickness / 2, wallHeight / 2, 0);
            walls[i].rotation.y = Math.PI / 2;
        }

        scene.add(walls[i]);
        objects.push(walls[i]);
    }
}

function createFloor() {
    const floorGeometry = new THREE.PlaneGeometry(5, 5);
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc });
    floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.userData.isHorizontal = (selectedOrientation === 'horizontal');
    scene.add(floor);
    objects.push(floor);
}

function initLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);
}
function addEventListeners() {
    const elements = {
        'modeTranslate': () => setTransformMode('translate'),
        'modeRotate': () => setTransformMode('rotate'),
        'lightIntensity': function (event) {
            const intensity = parseFloat(event.target.value);
            const ambientLight = scene.getObjectByProperty('type', 'AmbientLight');
            if (ambientLight) ambientLight.intensity = intensity;
        },
        'searchTile': filterTiles,
        'sinkModelInput': handleModelFile,
        'addSink': () => sinkModel ? addObject(sinkModel.clone(), 'sink') : alert('Veuillez d\'abord charger un modèle de lavabo.'),
        'addMirror': () => mirrorModel ? addObject(mirrorModel.clone(), 'mirror') : alert('Veuillez d\'abord charger un modèle de miroir.'),
        'addBidet': () => bidetModel ? addObject(bidetModel.clone(), 'bidet') : alert('Veuillez d\'abord charger un modèle de bidet.'),
        'removeObject': removeObject,
        'saveImageButton': saveSceneAsImage,
        'applySurfaceDimensions': applySurfaceDimensions,
        'applyTileDimensionsButton': () => {
            const width = parseFloat(document.getElementById('tileWidthInput').value);
            const height = parseFloat(document.getElementById('tileHeightInput').value);
            setNewTileDimensions(width, height);
            updateTileCount();
        },
        'singleTileButton': () => { isDoubleTile = false; applySelectedOrientation(); closeTileModal(); },
        'doubleTileButton': () => { isDoubleTile = true; firstTileSelected = false; applySelectedOrientation(); closeTileModal(); alert('Cliquez sur la première texture, puis sur la deuxième.'); },
        'closeModalButton': closeTileModal,
        'orientationSelect': (event) => selectedOrientation = event.target.value,
        'undoAction': undoLastAction,
        'redoAction': redoLastAction,
        'clearScene': clearScene,
        'toggleFullscreen': toggleFullscreen
    };

    Object.entries(elements).forEach(([id, handler]) => {
        const element = document.getElementById(id);
        if (element) element.addEventListener(element.tagName === 'INPUT' ? 'input' : 'click', handler, false);
    });

    document.querySelector('label[for="tileTextureInput"]').addEventListener('click', openPasswordModal);
    document.getElementById('togglePassword').addEventListener('change', togglePasswordVisibility);
    document.getElementById('confirmPasswordButton').addEventListener('click', confirmPassword);
    document.getElementById('cancelPasswordButton').addEventListener('click', closePasswordModal);
    document.getElementById('tileTextureInput').addEventListener('change', handleTileTextureInput);
    
    document.addEventListener('keydown', function (event) {
        if (event.key === 'Delete') {
            removeObject();
        }
    });

    renderer.domElement.addEventListener('click', handleInteraction);
    renderer.domElement.addEventListener('touchstart', handleInteraction);
    window.addEventListener('resize', onWindowResize, false);
}
function initializeTextureEvents() {
    document.querySelectorAll('.texture-option').forEach((img) => {
        img.addEventListener('click', async () => {
            if (isDoubleTile) {
                if (!firstTileSelected) {
                    try {
                        texture1 = await loadTexture(img.src);
                        firstTileSelected = true;
                        alert('Première texture sélectionnée. Choisissez maintenant la deuxième texture.');
                    } catch (error) {
                        alert('Erreur de chargement de la première texture.');
                    }
                } else {
                    try {
                        texture2 = await loadTexture(img.src);
                        firstTileSelected = false;
                        createCheckerboardMaterial();
                        alert('Deuxième texture sélectionnée. Le carrelage en alternance est appliqué.');
                    } catch (error) {
                        alert('Erreur de chargement de la deuxième texture.');
                    }
                }
            } else {
                try {
                    selectedTexture = await loadTexture(img.src);
                    applySelectedTexture();
                } catch (error) {
                    alert('Veuillez cliquer sur Mise à Zéro');
                }
            }
        });
    });
}

function loadTexture(src) {
    return new Promise((resolve, reject) => {
        const textureLoader = new THREE.TextureLoader();
        textureLoader.load(
            src,
            (texture) => {
                resolve(texture);
            },
            undefined,
            (error) => {
                reject(error);
            }
        );
    });
}

function applySelectedTexture() {
    if (!selectedTexture) {
        alert('Aucune texture sélectionnée. Veuillez choisir une texture.');
        return;
    }

    if (selectedWall) {
        adjustTextureScale(selectedWall, selectedTexture);
        saveAction('applyTexture', selectedWall, selectedTexture);
    } else if (selectedObject === floor) {
        adjustTextureScale(floor, selectedTexture);
        saveAction('applyTexture', floor, selectedTexture);
    } else {
        alert('Sélectionnez d\'abord un mur ou le sol en cliquant dessus, puis appliquez une texture.');
    }
}

function adjustTextureScale(object, texture) {
    if (!texture) {
        alert('Erreur : La texture n\'est pas chargée. Veuillez réessayer de sélectionner une texture.');
        return;
    }

    const objectWidth = object.geometry.parameters.width || object.scale.x;
    const objectHeight = object.geometry.parameters.height || object.scale.y;

    let repeatX, repeatY;

    if (object.userData.isHorizontal) {
        repeatX = objectWidth / currentTileHeight;
        repeatY = objectHeight / currentTileWidth;
    } else {
        repeatX = objectWidth / currentTileWidth;
        repeatY = objectHeight / currentTileHeight;
    }

    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeatX, repeatY);
    texture.rotation = 0;

    object.material.map = texture;
    object.material.color.set(0xffffff);
    object.material.needsUpdate = true;
}
function handleInteraction(event) {
    event.preventDefault();

    let x, y;
    if (event.type === 'touchstart') {
        if (event.touches.length > 1) return;
        const touch = event.changedTouches[0];
        x = touch.clientX;
        y = touch.clientY;
    } else {
        x = event.clientX;
        y = event.clientY;
    }

    mouse.x = (x / window.innerWidth) * 2 - 1;
    mouse.y = -(y / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects([...walls, floor, ...objects], true);

    if (intersects.length > 0) {
        const clickedObject = intersects[0].object;
        console.log('Objet cliqué :', clickedObject);

        clickCount++;

        clearTimeout(clickTimeout);
        clickTimeout = setTimeout(() => {
            clickCount = 0;
        }, 500);

        if (clickCount === 3) {
            handleTripleClick(clickedObject);
            clickCount = 0;
        } else if (clickCount === 2) {
            handleDoubleClick(clickedObject);
        }

        selectObject(clickedObject);
    } else {
        console.log('Aucun objet détecté lors du clic/tap.');
        transformControls.detach();
    }
}

function handleDoubleClick(object) {
    if (objects.includes(object) && object.userData.isMovable) {
        transformControls.attach(object);
        console.log('Double clic détecté sur un objet sanitaire :', object);
    } else {
        console.log('Double clic ignoré sur l\'objet :', object);
        transformControls.detach();
    }
}

function handleTripleClick(object) {
    if (object === floor || walls.includes(object)) {
        console.log('Triple clic détecté pour changer les dimensions ou texture :', object);
        openTileModal();
    } else {
        console.log('Triple clic ignoré sur un objet sanitaire.');
    }
}

function selectObject(object) {
    while (object.parent && object.parent !== scene) {
        object = object.parent;
    }

    if (object === floor) {
        selectedObject = floor;
        selectedWall = null;
        console.log('Sol sélectionné avec succès.');
        transformControls.detach();
    } else if (walls.includes(object)) {
        selectedWall = object;
        selectedObject = null;
        console.log('Mur sélectionné :', selectedWall);
        transformControls.detach();
    } else if (objects.includes(object)) {
        selectedObject = object;
        selectedWall = null;
        console.log('Objet sanitaire sélectionné :', selectedObject);

        if (selectedObject.userData.isMovable) {
            transformControls.attach(selectedObject);
            console.log('Transform controls attached.');
        } else {
            console.log('L\'objet sélectionné n\'est pas déplaçable.');
            transformControls.detach();
        }
    } else {
        selectedObject = null;
        selectedWall = null;
        console.log('Aucun objet ou mur n\'a été sélectionné.');
        transformControls.detach();
    }
}
function addObject(model, type) {
    model.userData.type = type;
    model.userData.isMovable = true;
    scene.add(model);
    objects.push(model);
    selectObject(model);
    saveAction('add', model);
}

function removeObject() {
    if (selectedObject && selectedObject.userData.isMovable) {
        saveAction('remove', selectedObject);
        scene.remove(selectedObject);
        objects = objects.filter(obj => obj !== selectedObject);
        transformControls.detach();
        selectedObject = null;
        alert('Objet supprimé avec succès.');
    } else {
        alert('Aucun objet sélectionné à supprimer.');
    }
}

function undoLastAction() {
    if (actionHistory.length > 0) {
        const lastAction = actionHistory.pop();
        redoStack.push(lastAction);

        switch (lastAction.action) {
            case 'add':
                scene.remove(lastAction.object);
                objects = objects.filter(obj => obj !== lastAction.object);
                break;
            case 'remove':
                scene.add(lastAction.object);
                objects.push(lastAction.object);
                break;
            case 'applyTexture':
                lastAction.object.material.map = lastAction.previousTexture || null;
                lastAction.object.material.needsUpdate = true;
                break;
            case 'applyCheckerboard':
                lastAction.object.material = lastAction.previousMaterial;
                lastAction.object.material.needsUpdate = true;
                break;
            default:
                console.warn('Action non reconnue:', lastAction.action);
        }
    } else {
        alert('Aucune action à annuler.');
    }
}

function redoLastAction() {
    if (redoStack.length > 0) {
        const lastRedo = redoStack.pop();
        actionHistory.push(lastRedo);

        switch (lastRedo.action) {
            case 'add':
                scene.add(lastRedo.object);
                objects.push(lastRedo.object);
                break;
            case 'remove':
                scene.remove(lastRedo.object);
                objects = objects.filter(obj => obj !== lastRedo.object);
                break;
            case 'applyTexture':
                adjustTextureScale(lastRedo.object, lastRedo.texture);
                break;
            case 'applyCheckerboard':
                adjustCheckerboardScale(lastRedo.object, lastRedo.material);
                break;
            default:
                console.warn('Action non reconnue:', lastRedo.action);
        }
    } else {
        alert('Aucune action à rétablir.');
    }
}

function saveAction(action, object, texture = null) {
    actionHistory.push({
        action: action,
        object: object,
        texture: texture,
        previousTexture: object && object.material ? object.material.map : null,
        previousMaterial: object && object.material ? object.material : null,
    });
    redoStack = [];
}

function setTransformMode(mode) {
    if (['translate', 'rotate'].includes(mode)) {
        transformControls.setMode(mode);
    } else {
        console.error('Mode de transformation non reconnu :', mode);
    }
}
function applySurfaceDimensions() {
    const floorWidth = parseFloat(document.getElementById('floorWidth').value) || 5;
    const floorDepth = parseFloat(document.getElementById('floorDepth').value) || 5;
    const wall1Width = parseFloat(document.getElementById('wall1Width').value) || 5;
    const wall2Width = parseFloat(document.getElementById('wall2Width').value) || 5;
    const wallHeight = parseFloat(document.getElementById('wallHeight').value) || 3;

    if (floor) {
        floor.geometry.dispose();
        floor.geometry = new THREE.PlaneGeometry(floorWidth, floorDepth);
    }

    if (walls[0]) {
        walls[0].geometry.dispose();
        walls[0].geometry = new THREE.BoxGeometry(wall1Width, wallHeight, 0.2);
        walls[0].position.set(0, wallHeight / 2, -floorDepth / 2 - 0.1);
    }

    if (walls[1]) {
        walls[1].geometry.dispose();
        walls[1].geometry = new THREE.BoxGeometry(wall2Width, wallHeight, 0.2);
        walls[1].position.set(-floorWidth / 2 - 0.1, wallHeight / 2, 0);
        walls[1].rotation.y = Math.PI / 2;
    }

    updateTileCount();
    alert('Dimensions du sol et des murs appliquées avec succès.');
}

function setNewTileDimensions(width, height) {
    currentTileWidth = width;
    currentTileHeight = height;
    updateTileCount();
    alert('Les dimensions des prochains carreaux seront : ' + currentTileWidth + 'm x ' + currentTileHeight + 'm.');
}

function updateTileCount() {
    const floorTileX = Math.ceil(floor.geometry.parameters.width / currentTileWidth);
    const floorTileY = Math.ceil(floor.geometry.parameters.height / currentTileHeight);
    console.log(`Nombre de carreaux sur le sol : ${floorTileX} x ${floorTileY}`);

    if (walls[0]) {
        const wallTileX1 = Math.ceil(walls[0].geometry.parameters.width / currentTileWidth);
        const wallTileY1 = Math.ceil(walls[0].geometry.parameters.height / currentTileHeight);
        console.log(`Nombre de carreaux sur le mur 1 : ${wallTileX1} x ${wallTileY1}`);
    }

    if (walls[1]) {
        const wallTileX2 = Math.ceil(walls[1].geometry.parameters.width / currentTileWidth);
        const wallTileY2 = Math.ceil(walls[1].geometry.parameters.height / currentTileHeight);
        console.log(`Nombre de carreaux sur le mur 2 : ${wallTileX2} x ${wallTileY2}`);
    }
}
function createCheckerboardMaterial() {
    if (!texture1 || !texture2) {
        alert('Les textures alternées ne sont pas correctement chargées. Réessayez de les sélectionner.');
        return;
    }

    const uniforms = {
        texture1: { type: 't', value: texture1 },
        texture2: { type: 't', value: texture2 },
        tileSizeX1: { type: 'f', value: selectedWall && selectedWall.userData.isHorizontal ? 1.0 / currentTileHeight : 1.0 / currentTileWidth },
        tileSizeY1: { type: 'f', value: selectedWall && selectedWall.userData.isHorizontal ? 1.0 / currentTileWidth : 1.0 / currentTileHeight },
        tileSizeX2: { type: 'f', value: selectedWall && selectedWall.userData.isHorizontal ? 1.0 / currentTileHeight : 1.0 / currentTileWidth },
        tileSizeY2: { type: 'f', value: selectedWall && selectedWall.userData.isHorizontal ? 1.0 / currentTileWidth : 1.0 / currentTileHeight }
    };

    const shaderMaterial = new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform sampler2D texture1;
            uniform sampler2D texture2;
            uniform float tileSizeX1;
            uniform float tileSizeY1;
            uniform float tileSizeX2;
            uniform float tileSizeY2;
            varying vec2 vUv;

            void main() {
                vec2 scaledUv1 = vec2(mod(vUv.x * tileSizeX1, 1.0), mod(vUv.y * tileSizeY1, 1.0));
                vec2 scaledUv2 = vec2(mod(vUv.x * tileSizeX2, 1.0), mod(vUv.y * tileSizeY2, 1.0));

                vec2 coords = floor(vec2(vUv.x / (1.0 / (tileSizeX1 + tileSizeX2)), vUv.y / (1.0 / (tileSizeY1 + tileSizeY2))));
                float checker = mod(coords.x + coords.y, 2.0);

                vec4 tex1 = texture2D(texture1, scaledUv1);
                vec4 tex2 = texture2D(texture2, scaledUv2);
                vec4 tileColor = mix(tex1, tex2, checker);

                gl_FragColor = tileColor;
            }
        `,
        side: THREE.DoubleSide
    });

    if (selectedWall) {
        adjustCheckerboardScale(selectedWall, shaderMaterial);
        selectedWall.material = shaderMaterial;
        saveAction('applyCheckerboard', selectedWall, shaderMaterial);
    } else if (selectedObject === floor) {
        adjustCheckerboardScale(floor, shaderMaterial);
        floor.material = shaderMaterial;
        saveAction('applyCheckerboard', floor, shaderMaterial);
    }
}

function adjustCheckerboardScale(object, shaderMaterial) {
    const objectWidth = object.geometry.parameters.width || object.scale.x;
    const objectHeight = object.geometry.parameters.height || object.scale.y;

    const repeatX = object.userData.isHorizontal ? objectWidth / (currentTileHeight * 2) : objectWidth / (currentTileWidth * 2);
    const repeatY = object.userData.isHorizontal ? objectHeight / (currentTileWidth * 2) : objectHeight / (currentTileHeight * 2);

    shaderMaterial.uniforms.tileSizeX1.value = repeatX;
    shaderMaterial.uniforms.tileSizeY1.value = repeatY;
    shaderMaterial.uniforms.tileSizeX2.value = repeatX;
    shaderMaterial.uniforms.tileSizeY2.value = repeatY;
}
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.log(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
        });
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
    updateFullscreenButton();
    updatePersistentControls();
}

function updateFullscreenButton() {
    const fullscreenIcon = document.getElementById('fullscreenIcon');
    if (document.fullscreenElement) {
        fullscreenIcon.textContent = '⛶';
    } else {
        fullscreenIcon.textContent = '⤢';
    }
}

function updatePersistentControls() {
    const persistentControls = document.querySelector('.persistent-controls');
    if (document.fullscreenElement) {
        persistentControls.style.opacity = '0';
        persistentControls.addEventListener('mouseover', showPersistentControls);
        persistentControls.addEventListener('mouseout', hidePersistentControls);
    } else {
        persistentControls.style.opacity = '1';
        persistentControls.removeEventListener('mouseover', showPersistentControls);
        persistentControls.removeEventListener('mouseout', hidePersistentControls);
    }
}

function showPersistentControls() {
    this.style.opacity = '1';
}

function hidePersistentControls() {
    this.style.opacity = '0';
}

document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement) {
        document.body.classList.add('fullscreen-mode');
    } else {
        document.body.classList.remove('fullscreen-mode');
    }
    updateFullscreenButton();
    updatePersistentControls();
});
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

function saveSceneAsImage() {
    try {
        renderer.render(scene, camera);
        const dataURL = renderer.domElement.toDataURL('image/png');

        const a = document.createElement('a');
        a.href = dataURL;
        a.download = 'bathroom_scene.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        alert('La scène a été sauvegardée en tant qu\'image!');
    } catch (error) {
        alert('Erreur lors de la sauvegarde de l\'image. Veuillez réessayer.');
    }
}

function clearScene() {
    objects.forEach(obj => scene.remove(obj));
    walls = [];
    floor = null;
    objects = [];
    selectedObject = null;
    selectedWall = null;
    actionHistory = [];
    redoStack = [];
    createWalls();
    createFloor();
    alert('La scène a été réinitialisée.');
}

function loadTexturesFromJson() {
    fetch('merged.json')
        .then(response => response.json())
        .then(data => {
            const texturePalette = document.getElementById('texturePalette');
            data.forEach(texture => {
                const img = document.createElement('img');
                img.src = texture.src;
                img.alt = texture.alt;
                img.classList.add('texture-option');
                texturePalette.appendChild(img);
            });
            initializeTextureEvents();
        })
        .catch(error => console.error('Erreur de chargement des textures depuis merged.json:', error));
}

// Initialiser la scène à l'ouverture
window.addEventListener('load', init);
function filterTiles() {
    const searchInput = document.getElementById('searchTile').value.toLowerCase();
    const textureOptions = document.querySelectorAll('.texture-option');

    textureOptions.forEach((texture) => {
        const altText = texture.alt.toLowerCase();
        texture.style.display = altText.includes(searchInput) ? 'block' : 'none';
    });
}

function handleModelFile(event) {
    const file = event.target.files[0];
    const type = event.target.dataset.type;
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const arrayBuffer = e.target.result;
            const extension = file.name.split('.').pop().toLowerCase();

            if (extension === 'gltf' || extension === 'glb') {
                gltfLoader.parse(arrayBuffer, '', function (gltf) {
                    handleModelLoad(gltf.scene, type);
                });
            } else if (extension === 'obj') {
                const text = new TextDecoder().decode(arrayBuffer);
                const objModel = objLoader.parse(text);
                handleModelLoad(objModel, type);
            } else if (extension === 'fbx') {
                fbxLoader.parse(arrayBuffer, function (fbx) {
                    handleModelLoad(fbx, type);
                });
            } else {
                alert('Format de modèle non supporté. Veuillez télécharger des fichiers .gltf, .glb, .obj ou .fbx.');
            }
        };
        reader.readAsArrayBuffer(file);
    }
}

function handleModelLoad(model, type) {
    model.rotation.set(0, 0, 0);
    model.scale.set(1, 1, 1);
    centerModel(model);

    model.userData.type = type;
    model.userData.isMovable = true;

    if (type === 'sink') sinkModel = model;
    else if (type === 'mirror') mirrorModel = model;
    else if (type === 'bidet') bidetModel = model;
}

function centerModel(model) {
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 1.25 / maxDim;
    model.scale.multiplyScalar(scale);

    model.position.sub(center.multiplyScalar(scale));
    model.position.y = size.y * scale / 2;
    model.position.z = -2.4;
}

function openTileModal() {
    document.getElementById('tileModal').classList.remove('hidden');
}

function closeTileModal() {
    document.getElementById('tileModal').classList.add('hidden');
}

function openPasswordModal() {
    document.getElementById('passwordModal').classList.remove('hidden');
}

function closePasswordModal() {
    document.getElementById('passwordModal').classList.add('hidden');
    document.getElementById('passwordInput').value = '';
    importAuthorized = false;
}


function togglePasswordVisibility() {
    const passwordInput = document.getElementById('passwordInput');
    passwordInput.type = this.checked ? 'text' : 'password';
}

function confirmPassword() {
    const password = document.getElementById('passwordInput').value;
    if (password === "sara") {
        importAuthorized = true;
        document.getElementById('tileTextureInput').click();
        closePasswordModal();
    } else {
        alert("Mot de passe incorrect. Importation annulée.");
    }
}

function handleTileTextureInput(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const textureLoader = new THREE.TextureLoader();
            textureLoader.load(e.target.result, (texture) => {
                selectedTexture = texture;
                if (selectedWall || selectedObject) {
                    applySelectedTexture();
                } else {
                    alert('Veuillez sélectionner un mur ou le sol avant de charger une texture.');
                }
                importAuthorized = false;
            }, undefined, (error) => {
                alert('Erreur lors du chargement de la texture. Veuillez vérifier le fichier.');
                importAuthorized = false;
            });
        };
        reader.readAsDataURL(file);
    }
}

function applySelectedOrientation() {
    if (selectedWall) {
        selectedWall.userData.isHorizontal = (selectedOrientation === 'horizontal');
        if (selectedWall.material.map) adjustTextureScale(selectedWall, selectedWall.material.map);
    } else if (selectedObject === floor) {
        floor.userData.isHorizontal = (selectedOrientation === 'horizontal');
        if (floor.material.map) adjustTextureScale(floor, floor.material.map);
    }
}

// Fonction pour le bouton de couleur de fond
document.getElementById('bgColorPicker').addEventListener('input', function (event) {
    const color = event.target.value;
    scene.background = new THREE.Color(color);
});

// Fonction pour sauvegarder la scène (peut être utilisée plus tard pour charger la scène)
function saveScene() {
    try {
        const sceneData = {
            walls: walls.map(wall => ({
                position: wall.position.toArray(),
                rotation: wall.rotation.toArray(),
                texture: wall.material.map ? wall.material.map.image.src : null
            })),
            floor: {
                position: floor.position.toArray(),
                rotation: floor.rotation.toArray(),
                texture: floor.material.map ? floor.material.map.image.src : null
            },
            objects: objects.filter(obj => obj.userData.isMovable).map(obj => ({
                type: obj.userData.type,
                position: obj.position.toArray(),
                rotation: obj.rotation.toArray(),
                scale: obj.scale.toArray()
            }))
        };

        localStorage.setItem('bathroomScene', JSON.stringify(sceneData));
        alert('Scène sauvegardée avec succès!');
    } catch (error) {
        alert('Erreur lors de la sauvegarde de la scène. Veuillez vérifier les paramètres et réessayer.');
    }
}

// Fonction pour charger la scène (à implémenter si nécessaire)
function loadScene() {
    // Implémentation à faire si nécessaire
}

// Ajout d'un écouteur d'événements pour le redimensionnement de la fenêtre
window.addEventListener('resize', onWindowResize, false);

// Fonction d'animation principale
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// Lancement de l'animation
animate();function applySelectedOrientation() {
    if (selectedWall) {
        selectedWall.userData.isHorizontal = (selectedOrientation === 'horizontal');
        if (selectedWall.material.map) adjustTextureScale(selectedWall, selectedWall.material.map);
    } else if (selectedObject === floor) {
        floor.userData.isHorizontal = (selectedOrientation === 'horizontal');
        if (floor.material.map) adjustTextureScale(floor, floor.material.map);
    }
}

document.getElementById('bgColorPicker').addEventListener('input', function (event) {
    const color = event.target.value;
    scene.background = new THREE.Color(color);
});

function saveScene() {
    try {
        const sceneData = {
            walls: walls.map(wall => ({
                position: wall.position.toArray(),
                rotation: wall.rotation.toArray(),
                texture: wall.material.map ? wall.material.map.image.src : null
            })),
            floor: {
                position: floor.position.toArray(),
                rotation: floor.rotation.toArray(),
                texture: floor.material.map ? floor.material.map.image.src : null
            },
            objects: objects.filter(obj => obj.userData.isMovable).map(obj => ({
                type: obj.userData.type,
                position: obj.position.toArray(),
                rotation: obj.rotation.toArray(),
                scale: obj.scale.toArray()
            }))
        };

        localStorage.setItem('bathroomScene', JSON.stringify(sceneData));
        alert('Scène sauvegardée avec succès!');
    } catch (error) {
        alert('Erreur lors de la sauvegarde de la scène. Veuillez vérifier les paramètres et réessayer.');
    }
}

function loadScene() {
    const savedScene = localStorage.getItem('bathroomScene');
    if (savedScene) {
        const sceneData = JSON.parse(savedScene);
        // Implémentation à faire pour charger les données de la scène
        // Cette fonction nécessiterait de recréer les objets, appliquer les textures, etc.
    } else {
        alert('Aucune scène sauvegardée trouvée.');
    }
}

window.addEventListener('resize', onWindowResize, false);

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

function filterTiles() {
    const searchInput = document.getElementById('searchTile').value.toLowerCase();
    const textureOptions = document.querySelectorAll('.texture-option');

    textureOptions.forEach((texture) => {
        const altText = texture.alt.toLowerCase();
        texture.style.display = altText.includes(searchInput) ? 'block' : 'none';
    });
}

function handleModelFile(event) {
    const file = event.target.files[0];
    const type = event.target.dataset.type;
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const arrayBuffer = e.target.result;
            const extension = file.name.split('.').pop().toLowerCase();

            if (extension === 'gltf' || extension === 'glb') {
                gltfLoader.parse(arrayBuffer, '', function (gltf) {
                    handleModelLoad(gltf.scene, type);
                });
            } else if (extension === 'obj') {
                const text = new TextDecoder().decode(arrayBuffer);
                const objModel = objLoader.parse(text);
                handleModelLoad(objModel, type);
            } else if (extension === 'fbx') {
                fbxLoader.parse(arrayBuffer, function (fbx) {
                    handleModelLoad(fbx, type);
                });
            } else {
                alert('Format de modèle non supporté. Veuillez télécharger des fichiers .gltf, .glb, .obj ou .fbx.');
            }
        };
        reader.readAsArrayBuffer(file);
    }
}

function handleModelLoad(model, type) {
    model.rotation.set(0, 0, 0);
    model.scale.set(1, 1, 1);
    centerModel(model);

    model.userData.type = type;
    model.userData.isMovable = true;

    if (type === 'sink') sinkModel = model;
    else if (type === 'mirror') mirrorModel = model;
    else if (type === 'bidet') bidetModel = model;
}

function centerModel(model) {
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 1.25 / maxDim;
    model.scale.multiplyScalar(scale);

    model.position.sub(center.multiplyScalar(scale));
    model.position.y = size.y * scale / 2;
    model.position.z = -2.4;
}

function openTileModal() {
    document.getElementById('tileModal').classList.remove('hidden');
}

function closeTileModal() {
    document.getElementById('tileModal').classList.add('hidden');
}

function openPasswordModal() {
    document.getElementById('passwordModal').classList.remove('hidden');
}

function closePasswordModal() {
    document.getElementById('passwordModal').classList.add('hidden');
    document.getElementById('passwordInput').value = '';
    importAuthorized = false;
}

function togglePasswordVisibility() {
    const passwordInput = document.getElementById('passwordInput');
    passwordInput.type = this.checked ? 'text' : 'password';
}

function confirmPassword() {
    const password = document.getElementById('passwordInput').value;
    if (password === "sara") {
        importAuthorized = true;
        document.getElementById('tileTextureInput').click();
        closePasswordModal();
    } else {
        alert("Mot de passe incorrect. Importation annulée.");
    }
}

function handleTileTextureInput(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const textureLoader = new THREE.TextureLoader();
            textureLoader.load(e.target.result, (texture) => {
                selectedTexture = texture;
                if (selectedWall || selectedObject) {
                    applySelectedTexture();
                } else {
                    alert('Veuillez sélectionner un mur ou le sol avant de charger une texture.');
                }
                importAuthorized = false;
            }, undefined, (error) => {
                alert('Erreur lors du chargement de la texture. Veuillez vérifier le fichier.');
                importAuthorized = false;
            });
        };
        reader.readAsDataURL(file);
    }
}

function loadTexturesFromJson() {
    fetch('merged.json')
        .then(response => response.json())
        .then(data => {
            const texturePalette = document.getElementById('texturePalette');
            data.forEach(texture => {
                const img = document.createElement('img');
                img.src = texture.src;
                img.alt = texture.alt;
                img.classList.add('texture-option');
                texturePalette.appendChild(img);
            });
            initializeTextureEvents();
        })
        .catch(error => console.error('Erreur de chargement des textures depuis merged.json:', error));
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.log(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
        });
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
    updateFullscreenButton();
    updatePersistentControls();
}

function updateFullscreenButton() {
    const fullscreenIcon = document.getElementById('fullscreenIcon');
    if (document.fullscreenElement) {
        fullscreenIcon.textContent = '⛶';
    } else {
        fullscreenIcon.textContent = '⤢';
    }
}

function updatePersistentControls() {
    const persistentControls = document.querySelector('.persistent-controls');
    if (document.fullscreenElement) {
        persistentControls.style.opacity = '0';
        persistentControls.addEventListener('mouseover', showPersistentControls);
        persistentControls.addEventListener('mouseout', hidePersistentControls);
    } else {
        persistentControls.style.opacity = '1';
        persistentControls.removeEventListener('mouseover', showPersistentControls);
        persistentControls.removeEventListener('mouseout', hidePersistentControls);
    }
}

function showPersistentControls() {
    this.style.opacity = '1';
}

function hidePersistentControls() {
    this.style.opacity = '0';
}

document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement) {
        document.body.classList.add('fullscreen-mode');
    } else {
        document.body.classList.remove('fullscreen-mode');
    }
    updateFullscreenButton();
    updatePersistentControls();
});




// Initialiser la scène à l'ouverture
window.addEventListener('load', init);




// Lancer l'animation
animate();



document.addEventListener('DOMContentLoaded', function() {
    document.addEventListener('contextmenu', function(event) {
        event.preventDefault();
    });
});


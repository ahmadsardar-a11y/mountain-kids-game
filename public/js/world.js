/**
 * world.js — Terrain, gems, props, and hazards generation
 */

const World = (function () {
    // ── Constants ──
    const MAP_SIZE = 200;
    const TERRAIN_SEGMENTS = 64;
    const GEM_COUNT = 25;
    const TREE_COUNT = 45;
    const ROCK_COUNT = 12;
    const ZOMBIE_COUNT = 6;
    const BOMB_COUNT = 8;
    const LAVA_COUNT = 5;
    const GEM_COLLECT_RADIUS = 3.5;
    const GEM_MIN_SPACING = 12;
    const BOMB_TRIGGER_RADIUS = 3.5;
    const ZOMBIE_COLLIDE_RADIUS = 7.0;
    const LAVA_COLLIDE_RADIUS = 5.0;
    const SPIN_DURATION = 3.0;
    const RAMP_COUNT = 3;
    const RAMP_GEM_COUNT = 3;

    // ── State ──
    let scene = null;
    let terrainMesh = null;
    let gemMesh = null;
    let glowMesh = null;
    let gemData = []; // { x, y, z, collected, index }
    let boulderData = [];
    let treeData = [];
    let rockData = [];
    let propsGroup = null;

    // Hazards
    let zombieData = [];
    let zombieGroup = null;
    let bombData = [];
    let bombGroup = null;
    let lavaData = [];
    let lavaGroup = null;

    // Ramps
    let rampData = [];
    let rampGroup = null;
    let rampGemIndices = [];

    // ── Noise Helpers ──
    function hash(x, z) {
        let n = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
        return n - Math.floor(n);
    }

    function lerp(a, b, t) {
        return a + (b - a) * t;
    }

    function smoothstep(t) {
        return t * t * (3 - 2 * t);
    }

    function noise(x, z) {
        let ix = Math.floor(x);
        let iz = Math.floor(z);
        let fx = x - ix;
        let fz = z - iz;
        fx = smoothstep(fx);
        fz = smoothstep(fz);

        let a = hash(ix, iz);
        let b = hash(ix + 1, iz);
        let c = hash(ix, iz + 1);
        let d = hash(ix + 1, iz + 1);

        return lerp(lerp(a, b, fx), lerp(c, d, fx), fz);
    }

    function fbm(x, z) {
        let val = 0;
        let amp = 1;
        let freq = 1;
        for (let i = 0; i < 4; i++) {
            val += noise(x * freq, z * freq) * amp;
            amp *= 0.5;
            freq *= 2.1;
        }
        return val;
    }

    // ── Terrain Height ──
    function getTerrainHeight(x, z) {
        let nx = x * 0.025;
        let nz = z * 0.025;
        let h = fbm(nx, nz);
        let edgeFade = 1;
        let half = MAP_SIZE / 2;
        let dx = Math.abs(x) / half;
        let dz = Math.abs(z) / half;
        let dist = Math.max(dx, dz);
        if (dist > 0.75) {
            edgeFade = 1 - (dist - 0.75) / 0.25;
            edgeFade = Math.max(0, edgeFade);
        }
        return (h * 10 - 3) * edgeFade;
    }

    // ── Terrain Slope ──
    function getSlope(x, z) {
        const delta = 1.0;
        let h0 = getTerrainHeight(x, z);
        let hx = getTerrainHeight(x + delta, z);
        let hz = getTerrainHeight(x, z + delta);
        let dx = (hx - h0) / delta;
        let dz = (hz - h0) / delta;
        return Math.sqrt(dx * dx + dz * dz);
    }

    // ── Terrain Mesh ──
    function createTerrain() {
        const geometry = new THREE.PlaneGeometry(
            MAP_SIZE, MAP_SIZE,
            TERRAIN_SEGMENTS, TERRAIN_SEGMENTS
        );
        geometry.rotateX(-Math.PI / 2);

        const positions = geometry.attributes.position;
        const colors = [];
        const color = new THREE.Color();

        for (let i = 0; i < positions.count; i++) {
            let x = positions.getX(i);
            let z = positions.getZ(i);
            let y = getTerrainHeight(x, z);
            positions.setY(i, y);

            if (y < 0) {
                color.setRGB(0.25, 0.55, 0.2);
            } else if (y < 4) {
                color.setRGB(0.5, 0.4, 0.25);
            } else if (y < 7) {
                color.setRGB(0.45, 0.35, 0.2);
            } else {
                color.setRGB(0.6, 0.6, 0.55);
            }
            colors.push(color.r, color.g, color.b);
        }

        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.computeVertexNormals();

        const material = new THREE.MeshLambertMaterial({
            vertexColors: true,
            flatShading: true
        });

        terrainMesh = new THREE.Mesh(geometry, material);
        terrainMesh.name = 'terrain';
        return terrainMesh;
    }

    // ── Gems ──
    function generateGemPositions() {
        const positions = [];
        let attempts = 0;
        while (positions.length < GEM_COUNT - RAMP_GEM_COUNT && attempts < 2000) {
            attempts++;
            let x = (Math.random() - 0.5) * MAP_SIZE * 0.85;
            let z = (Math.random() - 0.5) * MAP_SIZE * 0.85;
            let y = getTerrainHeight(x, z);

            if (getSlope(x, z) > 1.2) continue;
            if (y < -2) continue;

            let tooClose = false;
            for (let g of positions) {
                let dx = g.x - x;
                let dz = g.z - z;
                if (Math.sqrt(dx * dx + dz * dz) < GEM_MIN_SPACING) {
                    tooClose = true;
                    break;
                }
            }
            if (tooClose) continue;

            positions.push({ x, y: y + 1.2, z });
        }
        return positions;
    }

    function createGems() {
        const gemGeo = new THREE.OctahedronGeometry(0.7, 0);
        const gemMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0xffffff,
            emissiveIntensity: 2.5,
            roughness: 0.2,
            metalness: 0.1
        });

        gemMesh = new THREE.InstancedMesh(gemGeo, gemMat, GEM_COUNT);
        gemMesh.name = 'gems';

        const dummy = new THREE.Object3D();
        const color = new THREE.Color();
        gemData = [];

        const palette = [
            0x00FFFF, 0xFF00FF, 0xFFFF00, 0x00FF00, 0xFF6600
        ];

        const positions = generateGemPositions();

        // Fill regular gems
        for (let i = 0; i < GEM_COUNT - RAMP_GEM_COUNT; i++) {
            let pos = positions[i] || { x: 0, y: -1000, z: 0 };
            dummy.position.set(pos.x, pos.y, pos.z);
            dummy.rotation.set(0, Math.random() * Math.PI, 0);
            dummy.scale.set(1, 1, 1);
            dummy.updateMatrix();
            gemMesh.setMatrixAt(i, dummy.matrix);

            let c = palette[i % palette.length];
            color.setHex(c);
            gemMesh.setColorAt(i, color);

            gemData.push({ x: pos.x, y: pos.y, z: pos.z, collected: false, index: i, color: c });
        }

        // Fill ramp gems at ramp ends
        rampGemIndices = [];
        for (let i = 0; i < RAMP_GEM_COUNT; i++) {
            let idx = GEM_COUNT - RAMP_GEM_COUNT + i;
            let ramp = rampData[i % rampData.length];
            let pos = { x: ramp.endX, y: ramp.endY + 2.0, z: ramp.endZ };
            dummy.position.set(pos.x, pos.y, pos.z);
            dummy.rotation.set(0, Math.random() * Math.PI, 0);
            dummy.scale.set(1, 1, 1);
            dummy.updateMatrix();
            gemMesh.setMatrixAt(idx, dummy.matrix);

            let c = palette[idx % palette.length];
            color.setHex(c);
            gemMesh.setColorAt(idx, color);

            gemData.push({ x: pos.x, y: pos.y, z: pos.z, collected: false, index: idx, color: c });
            rampGemIndices.push(idx);
        }

        // Glow mesh
        const glowGeo = new THREE.OctahedronGeometry(1.0, 0);
        const glowMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.35,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        glowMesh = new THREE.InstancedMesh(glowGeo, glowMat, GEM_COUNT);
        glowMesh.name = 'glows';

        const glowDummy = new THREE.Object3D();
        for (let i = 0; i < GEM_COUNT; i++) {
            gemMesh.getMatrixAt(i, glowDummy.matrix);
            glowDummy.matrix.decompose(glowDummy.position, glowDummy.quaternion, glowDummy.scale);
            glowDummy.scale.set(1.4, 1.4, 1.4);
            glowDummy.updateMatrix();
            glowMesh.setMatrixAt(i, glowDummy.matrix);
        }

        const glowColor = new THREE.Color();
        for (let i = 0; i < GEM_COUNT; i++) {
            let c = palette[i % palette.length];
            glowColor.setHex(c);
            glowMesh.setColorAt(i, glowColor);
        }
        if (glowMesh.instanceColor) glowMesh.instanceColor.needsUpdate = true;
        glowMesh.instanceMatrix.needsUpdate = true;
        return gemMesh;
    }

    // ── Zombies ──
    function createZombieMesh() {
        const group = new THREE.Group();
        // Body: green box (10x original size)
        const bodyGeo = new THREE.BoxGeometry(6.0, 10.0, 4.0);
        const bodyMat = new THREE.MeshLambertMaterial({ color: 0x55AA55, flatShading: true });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 5.0;
        group.add(body);
        // Head: smaller box
        const headGeo = new THREE.BoxGeometry(4.0, 3.5, 4.0);
        const headMat = new THREE.MeshLambertMaterial({ color: 0x66CC66, flatShading: true });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 11.75;
        group.add(head);
        // Arms
        const armGeo = new THREE.BoxGeometry(1.5, 7.0, 1.5);
        const armMat = new THREE.MeshLambertMaterial({ color: 0x44AA44, flatShading: true });
        const leftArm = new THREE.Mesh(armGeo, armMat);
        leftArm.position.set(4.0, 5.0, 0);
        group.add(leftArm);
        const rightArm = new THREE.Mesh(armGeo, armMat);
        rightArm.position.set(-4.0, 5.0, 0);
        group.add(rightArm);
        return group;
    }

    function createZombies() {
        zombieGroup = new THREE.Group();
        zombieGroup.name = 'zombies';
        zombieData = [];

        for (let i = 0; i < ZOMBIE_COUNT; i++) {
            let x, z, y;
            let attempts = 0;
            do {
                x = (Math.random() - 0.5) * MAP_SIZE * 0.8;
                z = (Math.random() - 0.5) * MAP_SIZE * 0.8;
                y = getTerrainHeight(x, z);
                attempts++;
            } while ((getSlope(x, z) > 1.0 || y < -2) && attempts < 200);

            const mesh = createZombieMesh();
            mesh.position.set(x, y, z);
            zombieGroup.add(mesh);

            zombieData.push({
                x, y, z,
                spawnX: x, spawnZ: z,
                patrolRadius: 25 + Math.random() * 20,
                mesh,
                heading: Math.random() * Math.PI * 2,
                speed: 1.5 + Math.random() * 1.5,
                alive: true,
                wobbleOffset: Math.random() * Math.PI * 2
            });
        }
        return zombieGroup;
    }

    // ── Bombs ──
    function createBombMesh() {
        const group = new THREE.Group();
        // Main body: black sphere
        const bodyGeo = new THREE.SphereGeometry(0.8, 16, 16);
        const bodyMat = new THREE.MeshLambertMaterial({ color: 0x111111, flatShading: true });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.8;
        group.add(body);
        // Fuse: thin cylinder sticking out top
        const fuseGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.5, 6);
        const fuseMat = new THREE.MeshLambertMaterial({ color: 0x8B4513, flatShading: true });
        const fuse = new THREE.Mesh(fuseGeo, fuseMat);
        fuse.position.set(0, 1.55, 0);
        group.add(fuse);
        // Spark: small glowing yellow sphere at fuse tip
        const sparkGeo = new THREE.SphereGeometry(0.12, 8, 8);
        const sparkMat = new THREE.MeshBasicMaterial({ color: 0xFFFF00 });
        const spark = new THREE.Mesh(sparkGeo, sparkMat);
        spark.position.set(0, 1.85, 0);
        spark.name = 'spark';
        group.add(spark);
        return group;
    }

    function createBombs() {
        bombGroup = new THREE.Group();
        bombGroup.name = 'bombs';
        bombData = [];

        for (let i = 0; i < BOMB_COUNT; i++) {
            let x, z, y;
            let attempts = 0;
            do {
                x = (Math.random() - 0.5) * MAP_SIZE * 0.8;
                z = (Math.random() - 0.5) * MAP_SIZE * 0.8;
                y = getTerrainHeight(x, z);
                attempts++;
            } while ((getSlope(x, z) > 0.8 || y < -2) && attempts < 200);

            const mesh = createBombMesh();
            mesh.position.set(x, y, z);
            bombGroup.add(mesh);

            bombData.push({
                x, y, z,
                mesh,
                alive: true,
                pulseOffset: Math.random() * Math.PI * 2
            });
        }
        return bombGroup;
    }

    // ── Lava Pools ──
    function createLavaPools() {
        lavaGroup = new THREE.Group();
        lavaGroup.name = 'lava';
        lavaData = [];

        const lavaBaseGeo = new THREE.ConeGeometry(5.0, 3.5, 12);
        const lavaBaseMat = new THREE.MeshLambertMaterial({ color: 0x552211, flatShading: true });
        const lavaPoolGeo = new THREE.CircleGeometry(2.2, 16);
        lavaPoolGeo.rotateX(-Math.PI / 2);

        for (let i = 0; i < LAVA_COUNT; i++) {
            let x, z, y;
            let attempts = 0;
            do {
                x = (Math.random() - 0.5) * MAP_SIZE * 0.75;
                z = (Math.random() - 0.5) * MAP_SIZE * 0.75;
                y = getTerrainHeight(x, z);
                attempts++;
            } while ((getSlope(x, z) > 0.5 || y < -2) && attempts < 200);

            const mound = new THREE.Mesh(lavaBaseGeo, lavaBaseMat);
            mound.position.set(x, y + 1.75, z);
            lavaGroup.add(mound);

            const poolMat = new THREE.MeshBasicMaterial({
                color: 0xFF4400,
                transparent: true,
                opacity: 0.85,
                side: THREE.DoubleSide
            });
            const pool = new THREE.Mesh(lavaPoolGeo, poolMat);
            pool.position.set(x, y + 3.55, z);
            pool.name = 'pool';
            lavaGroup.add(pool);

            // Eruption particles group
            const particles = new THREE.Group();
            particles.position.set(x, y + 3.5, z);
            particles.name = 'particles';
            lavaGroup.add(particles);

            lavaData.push({
                x, y: y + 3.5, z,
                mound, pool, particles,
                state: 'calm',
                timer: 10 + Math.random() * 5,
                baseY: y + 3.5
            });
        }
        return lavaGroup;
    }

    // ── Ramps ──
    function createRamps() {
        rampGroup = new THREE.Group();
        rampGroup.name = 'ramps';
        rampData = [];

        const rampMat = new THREE.MeshLambertMaterial({ color: 0xFF6600, flatShading: true });
        const rampGeo = new THREE.BoxGeometry(6.0, 0.6, 12.0);
        const stripeMat = new THREE.MeshBasicMaterial({ color: 0xFFFF00 });

        for (let i = 0; i < RAMP_COUNT; i++) {
            let x, z, y;
            let attempts = 0;
            do {
                x = (Math.random() - 0.5) * MAP_SIZE * 0.7;
                z = (Math.random() - 0.5) * MAP_SIZE * 0.7;
                y = getTerrainHeight(x, z);
                attempts++;
            } while ((getSlope(x, z) > 0.4 || y < -1 || Math.abs(x) < 20 && Math.abs(z) < 20) && attempts < 200);

            const mesh = new THREE.Mesh(rampGeo, rampMat);
            // Tilt the ramp upward on Z axis
            const tiltAngle = 0.35 + Math.random() * 0.15;
            mesh.rotation.x = -tiltAngle;
            mesh.position.set(x, y + 1.2, z);
            rampGroup.add(mesh);

            // Yellow stripe on ramp
            const stripeGeo = new THREE.BoxGeometry(0.8, 0.62, 10.0);
            const stripe = new THREE.Mesh(stripeGeo, stripeMat);
            stripe.rotation.x = -tiltAngle;
            stripe.position.set(x, y + 1.2, z);
            rampGroup.add(stripe);

            // Calculate ramp end position (high end) for gem placement
            const rampLen = 12.0;
            const rampHeight = Math.sin(tiltAngle) * rampLen * 0.5;
            const endZ = z - Math.cos(tiltAngle) * rampLen * 0.5;
            const endY = y + 1.2 + Math.sin(tiltAngle) * rampLen * 0.5 + 0.3;

            rampData.push({
                x, y: y + 1.2, z,
                mesh,
                endX: x,
                endY: endY,
                endZ: endZ,
                tiltAngle,
                radius: 4.0
            });
        }
        return rampGroup;
    }

    // ── Props (Trees + Rocks) ──
    function createProps() {
        propsGroup = new THREE.Group();
        propsGroup.name = 'props';

        const treePositions = [];
        treeData = [];
        for (let i = 0; i < TREE_COUNT; i++) {
            let x = (Math.random() - 0.5) * MAP_SIZE * 0.9;
            let z = (Math.random() - 0.5) * MAP_SIZE * 0.9;
            let y = getTerrainHeight(x, z);
            if (y < -1.5 || getSlope(x, z) > 1.0) continue;
            let scale = 0.7 + Math.random() * 0.6;
            treePositions.push({ x, y, z, scale });
            treeData.push({ x, y, z, scale });
        }

        const treeGeo = new THREE.ConeGeometry(1.4, 4.0, 6);
        const treeMat = new THREE.MeshLambertMaterial({ color: 0x2D5A27, flatShading: true });
        const treeMesh = new THREE.InstancedMesh(treeGeo, treeMat, Math.max(treePositions.length, 1));
        const dummy = new THREE.Object3D();
        treePositions.forEach((tp, i) => {
            dummy.position.set(tp.x, tp.y + tp.scale * 2.0, tp.z);
            dummy.scale.set(tp.scale, tp.scale, tp.scale);
            dummy.rotation.set(0, Math.random() * Math.PI, 0);
            dummy.updateMatrix();
            treeMesh.setMatrixAt(i, dummy.matrix);
        });
        treeMesh.instanceMatrix.needsUpdate = true;
        treeMesh.name = 'trees';
        propsGroup.add(treeMesh);

        const rockPositions = [];
        rockData = [];
        for (let i = 0; i < ROCK_COUNT; i++) {
            let x = (Math.random() - 0.5) * MAP_SIZE * 0.9;
            let z = (Math.random() - 0.5) * MAP_SIZE * 0.9;
            let y = getTerrainHeight(x, z);
            if (y < -1.5 || getSlope(x, z) > 0.8) continue;
            let scale = 0.5 + Math.random() * 1.0;
            rockPositions.push({ x, y, z, scale });
            rockData.push({ x, y, z, scale });
        }

        const rockGeo = new THREE.DodecahedronGeometry(0.6, 0);
        const rockMat = new THREE.MeshLambertMaterial({ color: 0x777777, flatShading: true });
        const rockMesh = new THREE.InstancedMesh(rockGeo, rockMat, Math.max(rockPositions.length, 1));
        rockPositions.forEach((rp, i) => {
            dummy.position.set(rp.x, rp.y + rp.scale * 0.3, rp.z);
            dummy.scale.set(rp.scale, rp.scale * 0.7, rp.scale);
            dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
            dummy.updateMatrix();
            rockMesh.setMatrixAt(i, dummy.matrix);
        });
        rockMesh.instanceMatrix.needsUpdate = true;
        rockMesh.name = 'rocks';
        propsGroup.add(rockMesh);

        boulderData = [];
        const boulderPositions = [];
        const BOULDER_COUNT = 10;
        for (let i = 0; i < BOULDER_COUNT; i++) {
            let x = (Math.random() - 0.5) * MAP_SIZE * 0.85;
            let z = (Math.random() - 0.5) * MAP_SIZE * 0.85;
            let y = getTerrainHeight(x, z);
            if (getSlope(x, z) > 0.6) continue;
            if (Math.sqrt(x*x + z*z) < 15) continue;
            boulderPositions.push({ x, y, z });
            boulderData.push({ x, y, z });
        }

        const boulderGeo = new THREE.DodecahedronGeometry(1.2, 0);
        const boulderMat = new THREE.MeshLambertMaterial({ color: 0x555555, flatShading: true });
        const boulderMesh = new THREE.InstancedMesh(boulderGeo, boulderMat, Math.max(boulderPositions.length, 1));
        boulderPositions.forEach((bp, i) => {
            dummy.position.set(bp.x, bp.y + 1.0, bp.z);
            dummy.scale.set(1, 1, 1);
            dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
            dummy.updateMatrix();
            boulderMesh.setMatrixAt(i, dummy.matrix);
        });
        boulderMesh.instanceMatrix.needsUpdate = true;
        boulderMesh.name = 'boulders';
        propsGroup.add(boulderMesh);

        return propsGroup;
    }

    // ── Sky ──
    function createSky() {
        const skyGeo = new THREE.SphereGeometry(300, 16, 16);
        const skyMat = new THREE.MeshBasicMaterial({
            color: 0x87CEEB,
            side: THREE.BackSide
        });
        return new THREE.Mesh(skyGeo, skyMat);
    }

    // ── Lighting ──
    function createLights() {
        const hemi = new THREE.HemisphereLight(0x87CEEB, 0x5C3A1E, 0.7);
        const dir = new THREE.DirectionalLight(0xFFFFFF, 0.5);
        dir.position.set(50, 80, 30);
        return [hemi, dir];
    }

    // ── Fog ──
    function createFog() {
        return new THREE.Fog(0x87CEEB, 60, 180);
    }

    // ── Ramp collision ──
    function getRampHeight(x, z) {
        let bestHeight = -999;
        for (let r of rampData) {
            // Check if point is within ramp bounds (roughly)
            let dx = x - r.x;
            let dz = z - r.z;
            let dist = Math.sqrt(dx*dx + dz*dz);
            if (dist < 6.0) {
                // Estimate ramp surface height at this position
                let forwardZ = -Math.cos(r.tiltAngle); // ramp faces -Z when tilted
                let alongRamp = dz * forwardZ;
                let rampSurfaceY = r.y + Math.sin(r.tiltAngle) * alongRamp;
                if (rampSurfaceY > bestHeight) bestHeight = rampSurfaceY;
            }
        }
        return bestHeight;
    }
    function init(targetScene) {
        scene = targetScene;
        scene.fog = createFog();

        const lights = createLights();
        lights.forEach(l => scene.add(l));

        scene.add(createSky());
        scene.add(createTerrain());
        scene.add(createProps());
        scene.add(createZombies());
        scene.add(createBombs());
        scene.add(createLavaPools());
        scene.add(createRamps());
        scene.add(createGems());
        scene.add(glowMesh);
    }

    function update(time, dt) {
        // Spin gems
        if (gemMesh) {
            const dummy = new THREE.Object3D();
            for (let g of gemData) {
                if (g.collected) continue;
                gemMesh.getMatrixAt(g.index, dummy.matrix);
                dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
                dummy.rotation.y = time * 2 + g.index;
                dummy.updateMatrix();
                gemMesh.setMatrixAt(g.index, dummy.matrix);
            }
            gemMesh.instanceMatrix.needsUpdate = true;
        }
        // Spin glow meshes to match
        if (glowMesh) {
            const dummy = new THREE.Object3D();
            for (let g of gemData) {
                if (g.collected) continue;
                glowMesh.getMatrixAt(g.index, dummy.matrix);
                dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
                dummy.rotation.y = time * 2 + g.index;
                dummy.updateMatrix();
                glowMesh.setMatrixAt(g.index, dummy.matrix);
            }
            glowMesh.instanceMatrix.needsUpdate = true;
        }

        // Update hazards
        updateZombies(dt);
        updateBombs(time);
        updateLava(dt, time);
    }

    function updateZombies(dt) {
        const MAP_HALF = MAP_SIZE / 2 - 2;
        for (let z of zombieData) {
            if (!z.alive) continue;
            z.x += Math.sin(z.heading) * z.speed * dt;
            z.z += Math.cos(z.heading) * z.speed * dt;

            // Patrol radius: turn back toward spawn if too far
            let dx = z.x - z.spawnX;
            let dz = z.z - z.spawnZ;
            let distFromSpawn = Math.sqrt(dx*dx + dz*dz);
            if (distFromSpawn > z.patrolRadius) {
                let angleToSpawn = Math.atan2(-dx, -dz);
                let angleDiff = angleToSpawn - z.heading;
                while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
                z.heading += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), 2.0 * dt);
                z.x = z.spawnX + (dx / distFromSpawn) * z.patrolRadius;
                z.z = z.spawnZ + (dz / distFromSpawn) * z.patrolRadius;
            }

            // Map boundary bounce
            if (z.x > MAP_HALF || z.x < -MAP_HALF) {
                z.heading = Math.PI - z.heading;
                z.x = Math.max(-MAP_HALF, Math.min(MAP_HALF, z.x));
            }
            if (z.z > MAP_HALF || z.z < -MAP_HALF) {
                z.heading = -z.heading;
                z.z = Math.max(-MAP_HALF, Math.min(MAP_HALF, z.z));
            }

            // Random heading change (less frequent now)
            if (Math.random() < 0.015) {
                z.heading += (Math.random() - 0.5) * 1.5;
            }

            z.y = getTerrainHeight(z.x, z.z);
            z.mesh.position.set(z.x, z.y, z.z);
            z.mesh.rotation.y = z.heading + Math.PI;

            // Bobbing animation for large zombies
            z.mesh.children[0].position.y = 5.0 + Math.sin(Date.now() * 0.005 + z.wobbleOffset) * 0.3;
            z.mesh.children[1].position.y = 11.75 + Math.sin(Date.now() * 0.005 + z.wobbleOffset) * 0.3;
            z.mesh.children[2].position.y = 5.0 + Math.sin(Date.now() * 0.005 + z.wobbleOffset + 0.2) * 0.3;
            z.mesh.children[3].position.y = 5.0 + Math.sin(Date.now() * 0.005 + z.wobbleOffset - 0.2) * 0.3;
        }
    }

    function updateBombs(time) {
        for (let b of bombData) {
            if (!b.alive) continue;
            const pulse = Math.sin(time * 4 + b.pulseOffset) * 0.15 + 1.0;
            b.mesh.scale.set(pulse, pulse, pulse);
            const spark = b.mesh.getObjectByName('spark');
            if (spark) {
                spark.position.y = 1.85 + Math.sin(time * 10) * 0.05;
                const sPulse = Math.sin(time * 12) * 0.3 + 0.7;
                spark.scale.set(sPulse, sPulse, sPulse);
            }
        }
    }

    function updateLava(dt, time) {
        for (let l of lavaData) {
            l.timer -= dt;
            if (l.state === 'calm' && l.timer <= 0) {
                l.state = 'warning';
                l.timer = 3.0;
            } else if (l.state === 'warning' && l.timer <= 0) {
                l.state = 'erupt';
                l.timer = 2.0;
            } else if (l.state === 'erupt' && l.timer <= 0) {
                l.state = 'calm';
                l.timer = 10 + Math.random() * 5;
                // Clear particles
                while (l.particles.children.length > 0) {
                    l.particles.remove(l.particles.children[0]);
                }
            }

            if (l.state === 'warning') {
                const pulse = (Math.sin(time * 8) + 1) / 2;
                l.pool.material.color.setRGB(1.0, 0.15 + pulse * 0.5, 0.0);
                l.pool.material.opacity = 0.85 + pulse * 0.15;
                l.mound.scale.set(1.0 + pulse * 0.1, 1.0 + pulse * 0.2, 1.0 + pulse * 0.1);
            } else if (l.state === 'erupt') {
                l.pool.material.color.setHex(0xFFAA00);
                l.pool.material.opacity = 1.0;
                l.mound.scale.set(1.1, 1.15, 1.1);
                // Spawn eruption particles
                if (Math.random() < 0.3) {
                    const pGeo = new THREE.SphereGeometry(0.2 + Math.random() * 0.3, 6, 6);
                    const pMat = new THREE.MeshBasicMaterial({ color: 0xFF6600 });
                    const p = new THREE.Mesh(pGeo, pMat);
                    const angle = Math.random() * Math.PI * 2;
                    const radius = Math.random() * 2.0;
                    p.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
                    l.particles.add(p);
                }
                // Animate existing particles upward
                for (let p of l.particles.children) {
                    p.position.y += dt * (2.0 + Math.random() * 2.0);
                    p.scale.multiplyScalar(0.98);
                    if (p.position.y > 4.0 || p.scale.x < 0.1) {
                        l.particles.remove(p);
                    }
                }
            } else {
                l.pool.material.color.setHex(0xFF4400);
                l.pool.material.opacity = 0.85;
                l.mound.scale.set(1, 1, 1);
                while (l.particles.children.length > 0) {
                    l.particles.remove(l.particles.children[0]);
                }
            }
        }
    }

    function checkGemCollection(buggyPosition) {
        let collectedIndex = -1;
        for (let i = 0; i < gemData.length; i++) {
            let g = gemData[i];
            if (g.collected) continue;
            let dx = buggyPosition.x - g.x;
            let dz = buggyPosition.z - g.z;
            let dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < GEM_COLLECT_RADIUS) {
                g.collected = true;
                collectedIndex = i;

                const dummy = new THREE.Object3D();
                dummy.position.set(g.x, g.y, g.z);
                dummy.scale.set(0, 0, 0);
                dummy.updateMatrix();
                gemMesh.setMatrixAt(g.index, dummy.matrix);
                gemMesh.instanceMatrix.needsUpdate = true;
                if (glowMesh) {
                    glowMesh.setMatrixAt(g.index, dummy.matrix);
                    glowMesh.instanceMatrix.needsUpdate = true;
                }
                break;
            }
        }
        return collectedIndex;
    }

    function checkHazardCollisions(position, isAI) {
        // Zombies
        for (let i = zombieData.length - 1; i >= 0; i--) {
            let z = zombieData[i];
            if (!z.alive) continue;
            let dx = position.x - z.x;
            let dz = position.z - z.z;
            let dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < ZOMBIE_COLLIDE_RADIUS) {
                z.alive = false;
                zombieGroup.remove(z.mesh);
                return { type: 'zombie', spin: SPIN_DURATION };
            }
        }

        // Bombs
        for (let i = bombData.length - 1; i >= 0; i--) {
            let b = bombData[i];
            if (!b.alive) continue;
            let dx = position.x - b.x;
            let dz = position.z - b.z;
            let dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < BOMB_TRIGGER_RADIUS) {
                b.alive = false;
                bombGroup.remove(b.mesh);
                return { type: 'bomb', spin: SPIN_DURATION };
            }
        }

        // Lava
        for (let l of lavaData) {
            if (l.state !== 'erupt') continue;
            let dx = position.x - l.x;
            let dz = position.z - l.z;
            let dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < LAVA_COLLIDE_RADIUS) {
                return { type: 'lava', spin: SPIN_DURATION };
            }
        }

        return null;
    }

    function getCollectedCount() {
        return gemData.filter(g => g.collected).length;
    }

    function getTotalGems() {
        return GEM_COUNT;
    }

    function getUncollectedGems() {
        return gemData.filter(g => !g.collected);
    }

    function reset() {
        // Regenerate gem positions
        const dummy = new THREE.Object3D();
        const positions = generateGemPositions();
        for (let i = 0; i < GEM_COUNT - RAMP_GEM_COUNT; i++) {
            let pos = positions[i] || { x: 0, y: -1000, z: 0 };
            gemData[i].x = pos.x;
            gemData[i].y = pos.y;
            gemData[i].z = pos.z;
            gemData[i].collected = false;

            dummy.position.set(pos.x, pos.y, pos.z);
            dummy.rotation.set(0, Math.random() * Math.PI, 0);
            dummy.scale.set(1, 1, 1);
            dummy.updateMatrix();
            gemMesh.setMatrixAt(i, dummy.matrix);
        }

        // Reset ramp gems
        for (let i = 0; i < RAMP_GEM_COUNT; i++) {
            let idx = GEM_COUNT - RAMP_GEM_COUNT + i;
            let ramp = rampData[i % rampData.length];
            let pos = { x: ramp.endX, y: ramp.endY + 2.0, z: ramp.endZ };
            gemData[idx].x = pos.x;
            gemData[idx].y = pos.y;
            gemData[idx].z = pos.z;
            gemData[idx].collected = false;

            dummy.position.set(pos.x, pos.y, pos.z);
            dummy.rotation.set(0, Math.random() * Math.PI, 0);
            dummy.scale.set(1, 1, 1);
            dummy.updateMatrix();
            gemMesh.setMatrixAt(idx, dummy.matrix);
        }

        if (gemMesh) gemMesh.instanceMatrix.needsUpdate = true;

        if (glowMesh) {
            const glowDummy = new THREE.Object3D();
            for (let i = 0; i < GEM_COUNT; i++) {
                gemMesh.getMatrixAt(i, glowDummy.matrix);
                glowDummy.matrix.decompose(glowDummy.position, glowDummy.quaternion, glowDummy.scale);
                glowDummy.rotation.set(0, Math.random() * Math.PI, 0);
                glowDummy.scale.set(1.4, 1.4, 1.4);
                glowDummy.updateMatrix();
                glowMesh.setMatrixAt(i, glowDummy.matrix);
            }
            glowMesh.instanceMatrix.needsUpdate = true;
        }

        // Reset zombies
        if (zombieGroup) {
            scene.remove(zombieGroup);
        }
        zombieGroup = createZombies();
        scene.add(zombieGroup);

        // Reset bombs
        if (bombGroup) {
            scene.remove(bombGroup);
        }
        bombGroup = createBombs();
        scene.add(bombGroup);

        // Reset lava
        if (lavaGroup) {
            scene.remove(lavaGroup);
        }
        lavaGroup = createLavaPools();
        scene.add(lavaGroup);

        // Reset ramps
        if (rampGroup) {
            scene.remove(rampGroup);
        }
        rampGroup = createRamps();
        scene.add(rampGroup);
    }

    function getObstacleData() {
        const obstacles = [];
        for (let b of boulderData) {
            obstacles.push({ x: b.x, y: b.y, z: b.z, radius: 2.0 });
        }
        for (let t of treeData) {
            obstacles.push({ x: t.x, y: t.y, z: t.z, radius: 1.5 });
        }
        for (let r of rockData) {
            obstacles.push({ x: r.x, y: r.y, z: r.z, radius: 1.0 });
        }
        return obstacles;
    }

    function getBoulderData() {
        return boulderData;
    }

    return {
        init,
        update,
        getRampHeight,
        getTerrainHeight,
        getSlope,
        checkGemCollection,
        checkHazardCollisions,
        getCollectedCount,
        getTotalGems,
        getUncollectedGems,
        getBoulderData,
        getObstacleData,
        reset
    };
})();

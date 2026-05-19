/**
 * ai-buggy.js — AI Competitor Car
 */

const AIBuggy = (function () {
    // ── Constants ──
    const MAX_SPEED_EASY = 16.8;   // 60% of player 28
    const MAX_SPEED_HARD = 23.8;   // 85% of player 28
    const ACCELERATION = 14;
    const DECELERATION = 10;
    const TURN_SPEED = 2.2;
    const GROUND_CLEARANCE = 0.8;
    const MAP_HALF = 95;
    const BUGGY_RADIUS = 1.2;
    const SPIN_ROTATION_SPEED = 10;
    const GEM_COLLECT_RADIUS = 3.5;
    const IDLE_CHANCE = 0.2;

    // ── State ──
    let mesh = null;
    let wheels = [];
    let velocity = 0;
    let heading = 0;
    let position = new THREE.Vector3(0, 0, 0);
    let difficulty = 'easy';
    let scene = null;
    let targetGem = null;
    let idleTimer = 0;
    let spinTimer = 0;

    // ── Mesh Creation ──
    function createBody() {
        const group = new THREE.Group();
        group.name = 'ai-buggy';

        // Main chassis - blue
        const bodyGeo = new THREE.BoxGeometry(1.6, 0.5, 2.6);
        const bodyMat = new THREE.MeshLambertMaterial({ color: 0x3366CC, flatShading: true });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.55;
        group.add(body);

        // Hood
        const hoodGeo = new THREE.BoxGeometry(1.3, 0.3, 0.8);
        const hoodMat = new THREE.MeshLambertMaterial({ color: 0x3366CC, flatShading: true });
        const hood = new THREE.Mesh(hoodGeo, hoodMat);
        hood.position.set(0, 0.55, 1.4);
        hood.rotation.x = -0.15;
        group.add(hood);

        // Roll cage
        const barMat = new THREE.MeshLambertMaterial({ color: 0x333333, flatShading: true });
        const flBar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.6, 6), barMat);
        flBar.position.set(0.6, 0.9, 0.8); group.add(flBar);
        const frBar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.6, 6), barMat);
        frBar.position.set(-0.6, 0.9, 0.8); group.add(frBar);
        const rlBar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.6, 6), barMat);
        rlBar.position.set(0.6, 0.9, -0.8); group.add(rlBar);
        const rrBar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.6, 6), barMat);
        rrBar.position.set(-0.6, 0.9, -0.8); group.add(rrBar);

        const crossFront = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 6), barMat);
        crossFront.rotation.z = Math.PI / 2;
        crossFront.position.set(0, 1.2, 0.8); group.add(crossFront);
        const crossRear = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 6), barMat);
        crossRear.rotation.z = Math.PI / 2;
        crossRear.position.set(0, 1.2, -0.8); group.add(crossRear);
        const sideLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 6), barMat);
        sideLeft.rotation.x = Math.PI / 2;
        sideLeft.position.set(0.6, 1.2, 0); group.add(sideLeft);
        const sideRight = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 6), barMat);
        sideRight.rotation.x = Math.PI / 2;
        sideRight.position.set(-0.6, 1.2, 0); group.add(sideRight);

        // Seat
        const seatGeo = new THREE.BoxGeometry(0.8, 0.3, 0.6);
        const seatMat = new THREE.MeshLambertMaterial({ color: 0x444444, flatShading: true });
        const seat = new THREE.Mesh(seatGeo, seatMat);
        seat.position.set(0, 0.4, -0.2); group.add(seat);

        // Headlights
        const lightMat = new THREE.MeshBasicMaterial({ color: 0xFFFFAA });
        const leftLight = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), lightMat);
        leftLight.position.set(0.5, 0.55, 1.35); group.add(leftLight);
        const rightLight = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), lightMat);
        rightLight.position.set(-0.5, 0.55, 1.35); group.add(rightLight);

        return group;
    }

    function createWheel() {
        const geo = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 8);
        geo.rotateZ(Math.PI / 2);
        const mat = new THREE.MeshLambertMaterial({ color: 0x222222, flatShading: true });
        return new THREE.Mesh(geo, mat);
    }

    function createBuggy() {
        const buggy = createBody();
        const fl = createWheel(); fl.position.set(0.8, 0.4, 1.0); buggy.add(fl);
        const fr = createWheel(); fr.position.set(-0.8, 0.4, 1.0); buggy.add(fr);
        const rl = createWheel(); rl.position.set(0.8, 0.4, -1.0); buggy.add(rl);
        const rr = createWheel(); rr.position.set(-0.8, 0.4, -1.0); buggy.add(rr);
        wheels = [fl, fr, rl, rr];
        return buggy;
    }

    // ── Init ──
    function init(targetScene, getTerrainHeight, diff) {
        scene = targetScene;
        difficulty = diff || 'easy';
        mesh = createBuggy();

        // Find a flat starting spot, away from player (center)
        let bestY = -999;
        let bestX = 0;
        let bestZ = 0;
        for (let i = 0; i < 100; i++) {
            let x = (Math.random() - 0.5) * 80;
            let z = (Math.random() - 0.5) * 80;
            // Keep away from center (player start)
            if (Math.abs(x) < 20 && Math.abs(z) < 20) continue;
            let y = getTerrainHeight(x, z);
            if (y > bestY) {
                bestY = y;
                bestX = x;
                bestZ = z;
            }
        }

        position.set(bestX, bestY + GROUND_CLEARANCE, bestZ);
        mesh.position.copy(position);
        targetScene.add(mesh);
    }

    // ── AI Logic ──
    function pickTargetGem() {
        const gems = World.getUncollectedGems();
        if (gems.length === 0) return null;

        if (difficulty === 'hard') {
            // Greedy: nearest gem
            let nearest = null;
            let nearestDist = Infinity;
            for (let g of gems) {
                let dx = g.x - position.x;
                let dz = g.z - position.z;
                let dist = Math.sqrt(dx*dx + dz*dz);
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearest = g;
                }
            }
            return nearest;
        } else {
            // Easy: random gem
            return gems[Math.floor(Math.random() * gems.length)];
        }
    }

    // ── Update ──
    function update(dt, getTerrainHeight, getObstacleData) {
        const maxSpeed = difficulty === 'hard' ? MAX_SPEED_HARD : MAX_SPEED_EASY;

        // Spin state
        if (spinTimer > 0) {
            spinTimer -= dt;
            heading += SPIN_ROTATION_SPEED * dt;
            mesh.rotation.y = heading;
            // Wobble while spinning
            mesh.rotation.x = Math.sin(Date.now() * 0.02) * 0.3;
            mesh.rotation.z = Math.cos(Date.now() * 0.025) * 0.2;

            let groundY = getTerrainHeight(position.x, position.z);
            position.y = groundY + GROUND_CLEARANCE;
            mesh.position.copy(position);

            if (spinTimer <= 0) {
                mesh.rotation.x = 0;
                mesh.rotation.z = 0;
            }
            return velocity / MAX_SPEED_EASY;
        }

        // Pick target if needed
        if (!targetGem || targetGem.collected) {
            targetGem = pickTargetGem();
        }

        // Easy mode: idle chance
        if (difficulty === 'easy') {
            if (idleTimer > 0) {
                idleTimer -= dt;
                // Natural deceleration while idle
                let decel = DECELERATION * dt;
                if (Math.abs(velocity) <= decel) velocity = 0;
                else velocity -= Math.sign(velocity) * decel;

                let groundY = getTerrainHeight(position.x, position.z);
                position.y = groundY + GROUND_CLEARANCE;
                mesh.position.copy(position);
                mesh.rotation.y = heading;
                return 0;
            }
            if (Math.random() < IDLE_CHANCE * dt) {
                idleTimer = 1.0 + Math.random() * 2.0;
            }
        }

        // AI steering toward target
        let throttle = 0;
        let steering = 0;

        if (targetGem) {
            let dx = targetGem.x - position.x;
            let dz = targetGem.z - position.z;
            let dist = Math.sqrt(dx*dx + dz*dz);
            let targetHeading = Math.atan2(dx, dz);

            // Normalize angle difference to -PI..PI
            let angleDiff = targetHeading - heading;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

            // More precise steering when close to gem
            let steerFactor = dist < 6 ? 3.5 : 2.0;
            steering = Math.max(-1, Math.min(1, angleDiff * steerFactor));
            throttle = 1.0;

            // Slow down when close to target
            if (dist < 8) throttle = 0.6;
            if (dist < 4) throttle = 0.3;
            if (dist < 2.5) throttle = 0.15; // crawl when very close
        } else {
            // No gems left - cruise slowly
            throttle = 0.3;
            steering = Math.sin(Date.now() * 0.001) * 0.5;
        }

        // Acceleration
        if (Math.abs(throttle) > 0.05) {
            let targetSpeed = throttle > 0 ? maxSpeed : -maxSpeed * 0.4;
            let accel = ACCELERATION * dt;
            if (throttle < 0) {
                velocity -= accel;
                velocity = Math.max(velocity, targetSpeed);
            } else {
                velocity += accel;
                velocity = Math.min(velocity, targetSpeed);
            }
        } else {
            let decel = DECELERATION * dt;
            if (Math.abs(velocity) <= decel) velocity = 0;
            else velocity -= Math.sign(velocity) * decel;
        }

        // Steering (only when moving)
        if (Math.abs(velocity) > 0.1) {
            let turn = -steering * TURN_SPEED * dt;
            if (velocity < 0) turn *= -0.8;
            heading += turn;
        }

        // Movement
        let forwardX = Math.sin(heading);
        let forwardZ = Math.cos(heading);
        position.x += forwardX * velocity * dt;
        position.z += forwardZ * velocity * dt;

        // Map boundaries
        position.x = Math.max(-MAP_HALF, Math.min(MAP_HALF, position.x));
        position.z = Math.max(-MAP_HALF, Math.min(MAP_HALF, position.z));

        // Obstacle collision
        if (getObstacleData && getObstacleData.length > 0) {
            for (let obs of getObstacleData) {
                let dx = position.x - obs.x;
                let dz = position.z - obs.z;
                let dist = Math.sqrt(dx * dx + dz * dz);
                if (dist < obs.radius + BUGGY_RADIUS && dist > 0.001) {
                    let push = (obs.radius + BUGGY_RADIUS - dist) / dist;
                    position.x += dx * push;
                    position.z += dz * push;
                    velocity *= 0.5;
                }
            }
        }

        // Ground clamping
        let groundY = getTerrainHeight(position.x, position.z);
        position.y = groundY + GROUND_CLEARANCE;

        // Apply to mesh
        mesh.position.copy(position);
        mesh.rotation.y = heading;

        // Terrain-based pitch and roll
        let slopeX = getTerrainHeight(position.x + 0.5, position.z) - getTerrainHeight(position.x - 0.5, position.z);
        let slopeZ = getTerrainHeight(position.x, position.z + 0.5) - getTerrainHeight(position.x, position.z - 0.5);
        mesh.rotation.x = -slopeZ * 0.5;
        mesh.rotation.z = slopeX * 0.5;

        // Wheel spin
        let wheelSpin = velocity * dt * 3;
        for (let w of wheels) {
            w.rotation.x += wheelSpin;
        }

        return velocity / maxSpeed;
    }

    function triggerSpin() {
        spinTimer = 3.0;
    }

    function isSpinning() {
        return spinTimer > 0;
    }

    function getPosition() {
        return position;
    }

    function reset(getTerrainHeight, diff) {
        difficulty = diff || difficulty;
        velocity = 0;
        heading = 0;
        spinTimer = 0;
        targetGem = null;
        idleTimer = 0;

        let bestY = -999;
        let bestX = 0;
        let bestZ = 0;
        for (let i = 0; i < 100; i++) {
            let x = (Math.random() - 0.5) * 80;
            let z = (Math.random() - 0.5) * 80;
            if (Math.abs(x) < 20 && Math.abs(z) < 20) continue;
            let y = getTerrainHeight(x, z);
            if (y > bestY) {
                bestY = y;
                bestX = x;
                bestZ = z;
            }
        }
        position.set(bestX, bestY + GROUND_CLEARANCE, bestZ);
        mesh.position.copy(position);
        mesh.rotation.set(0, 0, 0);
    }

    return {
        init,
        update,
        reset,
        getPosition,
        triggerSpin,
        isSpinning
    };
})();

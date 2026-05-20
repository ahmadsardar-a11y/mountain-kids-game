/**
 * buggy.js — Vehicle mesh, movement, and camera
 */

const Buggy = (function () {
    // ── Constants ──
    const IS_TOUCH = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const MAX_SPEED = IS_TOUCH ? 20 : 28;
    const REVERSE_SPEED = IS_TOUCH ? 8 : 12;
    const ACCELERATION = 18;
    const DECELERATION = 10;
    const BRAKE_FORCE = 30;
    const TURN_SPEED = IS_TOUCH ? 1.8 : 2.8;
    const GROUND_CLEARANCE = 0.8;
    const CAMERA_OFFSET = new THREE.Vector3(0, 6, -10);
    const CAMERA_LERP = 0.12;
    const MAP_HALF = 95;
    const BUGGY_RADIUS = 1.2;

    // ── State ──
    let mesh = null;
    let wheels = [];
    let velocity = 0;
    let heading = 0;
    let position = new THREE.Vector3(0, 0, 0);
    let camera = null;
    let cameraTarget = new THREE.Vector3();
    let spinTimer = 0;
    const SPIN_ROTATION_SPEED = 10;

    // ── Mesh Creation ──
    function createBody() {
        const group = new THREE.Group();
        group.name = 'buggy';

        // Main chassis - wider, lower
        const bodyGeo = new THREE.BoxGeometry(1.6, 0.5, 2.6);
        const bodyMat = new THREE.MeshLambertMaterial({ color: 0xCC3333, flatShading: true });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.55;
        group.add(body);

        // Hood slope - smaller box at front, angled up
        const hoodGeo = new THREE.BoxGeometry(1.3, 0.3, 0.8);
        const hoodMat = new THREE.MeshLambertMaterial({ color: 0xCC3333, flatShading: true });
        const hood = new THREE.Mesh(hoodGeo, hoodMat);
        hood.position.set(0, 0.55, 1.4);
        hood.rotation.x = -0.15;
        group.add(hood);

        // Roll cage bars - 4 thin vertical cylinders at corners
        const barMat = new THREE.MeshLambertMaterial({ color: 0x333333, flatShading: true });

        const flBar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.6, 6), barMat);
        flBar.position.set(0.6, 0.9, 0.8);
        group.add(flBar);

        const frBar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.6, 6), barMat);
        frBar.position.set(-0.6, 0.9, 0.8);
        group.add(frBar);

        const rlBar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.6, 6), barMat);
        rlBar.position.set(0.6, 0.9, -0.8);
        group.add(rlBar);

        const rrBar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.6, 6), barMat);
        rrBar.position.set(-0.6, 0.9, -0.8);
        group.add(rrBar);

        // Cross bar front
        const crossFront = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 6), barMat);
        crossFront.rotation.z = Math.PI / 2;
        crossFront.position.set(0, 1.2, 0.8);
        group.add(crossFront);

        // Cross bar rear
        const crossRear = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 6), barMat);
        crossRear.rotation.z = Math.PI / 2;
        crossRear.position.set(0, 1.2, -0.8);
        group.add(crossRear);

        // Side bar left
        const sideLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 6), barMat);
        sideLeft.rotation.x = Math.PI / 2;
        sideLeft.position.set(0.6, 1.2, 0);
        group.add(sideLeft);

        // Side bar right
        const sideRight = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 6), barMat);
        sideRight.rotation.x = Math.PI / 2;
        sideRight.position.set(-0.6, 1.2, 0);
        group.add(sideRight);

        // Seat
        const seatGeo = new THREE.BoxGeometry(0.8, 0.3, 0.6);
        const seatMat = new THREE.MeshLambertMaterial({ color: 0x444444, flatShading: true });
        const seat = new THREE.Mesh(seatGeo, seatMat);
        seat.position.set(0, 0.4, -0.2);
        group.add(seat);

        // Steering wheel
        const steerGeo = new THREE.TorusGeometry(0.12, 0.02, 4, 8);
        const steerMat = new THREE.MeshLambertMaterial({ color: 0x222222, flatShading: true });
        const steer = new THREE.Mesh(steerGeo, steerMat);
        steer.position.set(0, 0.7, 0.5);
        steer.rotation.x = -0.4;
        group.add(steer);

        // Front bumper
        const bumperGeo = new THREE.BoxGeometry(1.3, 0.2, 0.3);
        const bumperMat = new THREE.MeshLambertMaterial({ color: 0x888888, flatShading: true });
        const bumper = new THREE.Mesh(bumperGeo, bumperMat);
        bumper.position.set(0, 0.4, 1.3);
        group.add(bumper);

        // Headlights
        const lightMat = new THREE.MeshBasicMaterial({ color: 0xFFFFAA });
        const leftLight = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), lightMat);
        leftLight.position.set(0.5, 0.55, 1.35);
        group.add(leftLight);

        const rightLight = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), lightMat);
        rightLight.position.set(-0.5, 0.55, 1.35);
        group.add(rightLight);

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

        // 4 wheels - chunkier tires, wider positions
        const fl = createWheel(); fl.position.set(0.8, 0.4, 1.0);  buggy.add(fl);
        const fr = createWheel(); fr.position.set(-0.8, 0.4, 1.0); buggy.add(fr);
        const rl = createWheel(); rl.position.set(0.8, 0.4, -1.0); buggy.add(rl);
        const rr = createWheel(); rr.position.set(-0.8, 0.4, -1.0); buggy.add(rr);

        wheels = [fl, fr, rl, rr];
        return buggy;
    }

    // ── Init ──
    function init(targetScene, targetCamera, getTerrainHeight) {
        mesh = createBuggy();
        camera = targetCamera;

        // Find a flat starting spot
        let bestY = -999;
        let bestX = 0;
        let bestZ = 0;
        for (let i = 0; i < 50; i++) {
            let x = (Math.random() - 0.5) * 60;
            let z = (Math.random() - 0.5) * 60;
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

        // Initial camera
        updateCamera(getTerrainHeight, true);
    }

    // ── Physics Update ──
    function update(dt, getTerrainHeight, throttle, steering, braking, obstacleData, getRampHeight) {
        // Spin state
        if (spinTimer > 0) {
            spinTimer -= dt;
            heading += SPIN_ROTATION_SPEED * dt;
            mesh.rotation.y = heading;
            // Wobble while spinning
            mesh.rotation.x = Math.sin(Date.now() * 0.02) * 0.3;
            mesh.rotation.z = Math.cos(Date.now() * 0.025) * 0.2;

            let groundY = getTerrainHeight(position.x, position.z);
            let rampY = getRampHeight ? getRampHeight(position.x, position.z) : -999;
            let finalY = Math.max(groundY, rampY);
            position.y = finalY + GROUND_CLEARANCE;
            mesh.position.copy(position);

            if (spinTimer <= 0) {
                mesh.rotation.x = 0;
                mesh.rotation.z = 0;
            }
            updateCamera(getTerrainHeight, false);
            return velocity / MAX_SPEED;
        }

        // Acceleration
        if (Math.abs(throttle) > 0.05) {
            let targetSpeed = throttle > 0 ? MAX_SPEED : -REVERSE_SPEED;
            let accel = throttle > 0 ? ACCELERATION : ACCELERATION * 0.6;
            if (throttle < 0) {
                // Reversing
                velocity -= accel * dt;
                velocity = Math.max(velocity, targetSpeed);
            } else {
                velocity += accel * dt;
                velocity = Math.min(velocity, targetSpeed);
            }
        } else {
            // Natural deceleration
            let decel = DECELERATION * dt;
            if (Math.abs(velocity) <= decel) {
                velocity = 0;
            } else {
                velocity -= Math.sign(velocity) * decel;
            }
        }

        // Brake
        if (braking) {
            let brake = BRAKE_FORCE * dt;
            if (Math.abs(velocity) <= brake) {
                velocity = 0;
            } else {
                velocity -= Math.sign(velocity) * brake;
            }
        }

        // Steering (only when moving)
        if (Math.abs(velocity) > 0.1) {
            let turn = -steering * TURN_SPEED * dt;
            // Turn less when reversing
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

        // Obstacle collision (boulders, trees, rocks)
        if (obstacleData && obstacleData.length > 0) {
            for (let obs of obstacleData) {
                let dx = position.x - obs.x;
                let dz = position.z - obs.z;
                let dist = Math.sqrt(dx * dx + dz * dz);
                if (dist < obs.radius + BUGGY_RADIUS && dist > 0.001) {
                    let push = (obs.radius + BUGGY_RADIUS - dist) / dist;
                    position.x += dx * push;
                    position.z += dz * push;
                    velocity *= 0.5; // bounce slowdown
                }
            }
        }

        // Ground clamping (use ramp height if on ramp)
        let groundY = getTerrainHeight(position.x, position.z);
        let rampY = getRampHeight ? getRampHeight(position.x, position.z) : -999;
        let finalY = Math.max(groundY, rampY);
        position.y = finalY + GROUND_CLEARANCE;

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

        // Camera
        updateCamera(getTerrainHeight, false);

        return velocity / MAX_SPEED;
    }

    function updateCamera(getTerrainHeight, instant) {
        // Camera position behind buggy
        let offset = CAMERA_OFFSET.clone();
        offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), heading);
        cameraTarget.copy(position).add(offset);

        // Keep camera above ground
        let camGround = getTerrainHeight(cameraTarget.x, cameraTarget.z);
        if (cameraTarget.y < camGround + 2) {
            cameraTarget.y = camGround + 2;
        }

        if (instant) {
            camera.position.copy(cameraTarget);
        } else {
            camera.position.lerp(cameraTarget, CAMERA_LERP);
        }

        camera.lookAt(position.x, position.y + 1, position.z);
    }

    // ── Reset ──
    function reset(getTerrainHeight) {
        velocity = 0;
        heading = 0;

        let bestY = -999;
        let bestX = 0;
        let bestZ = 0;
        for (let i = 0; i < 50; i++) {
            let x = (Math.random() - 0.5) * 60;
            let z = (Math.random() - 0.5) * 60;
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
        updateCamera(getTerrainHeight, true);
    }

    function getPosition() {
        return position;
    }

    function triggerSpin() {
        spinTimer = 3.0;
    }

    function isSpinning() {
        return spinTimer > 0;
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

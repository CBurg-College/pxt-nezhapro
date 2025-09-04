/*
The code below is a refactoring of:
- the ElecFreaks 'pxt-nezha2' library:
  https://github.com/elecfreaks/pxt-nezha2/blob/master/main.ts
MIT-license.
*/

namespace NezhaPro {

    let i2cAddr: number = 0x10;
    let servoSpeedGlobal = 900
    let relAngleArr = [0, 0, 0, 0];

    let MFL = 0
    let MFR = 1
    let MRL = 2
    let MRR = 3
    let Motors = [Motor.M1, Motor.M2, Motor.M3, Motor.M4]
    let Revert = [false, false, false, false]

    export enum Mode {
        //% block="revolutions"
        //% block.loc.nl="omwentelingen"
        Circle = 1,
        //% block="degrees"
        //% block.loc.nl="graden"
        Degree = 2,
        //% block="seconds"
        //% block.loc.nl"seconden""
        Second = 3
    }

    export enum DelayMode {
        AutoDelayStatus = 1,
        NoDelay = 0
    }

    export function delayMs(ms: number): void {

        let time = input.runningTime() + ms
        while (time >= input.runningTime()) { }
    }

    export function motorDelay(value: number, motorFunction: Mode) {

        let delayTime = 0;
        if (value == 0 || servoSpeedGlobal == 0) {
            return;
        } else if (motorFunction == Mode.Circle) {
            delayTime = value * 360000.0 / servoSpeedGlobal + 500;
        } else if (motorFunction == Mode.Second) {
            delayTime = (value * 1000);
        } else if (motorFunction == Mode.Degree) {
            delayTime = value * 1000.0 / servoSpeedGlobal + 500;
        }
        basic.pause(delayTime);
    }

    function _move(motor: Motor, rotation: Spin, value: number, mode: Mode): void {

        let buf = pins.createBuffer(8);
        buf[0] = 0xFF;
        buf[1] = 0xF9;
        buf[2] = motor + 1;
        buf[3] = rotation + 1;
        buf[4] = 0x70;
        buf[5] = (value >> 8) & 0XFF;
        buf[6] = mode;
        buf[7] = (value >> 0) & 0XFF;
        pins.i2cWriteBuffer(i2cAddr, buf);
    }

    export function _turnToAngle(motor: Motor, rotation: Spin, angle: number, isDelay: DelayMode = DelayMode.AutoDelayStatus): void {

        while (angle < 0)
            angle += 360
        angle %= 360
        let buf = pins.createBuffer(8)
        buf[0] = 0xFF;
        buf[1] = 0xF9;
        buf[2] = motor + 1;
        buf[3] = 0x00;
        buf[4] = 0x5D;
        buf[5] = (angle >> 8) & 0XFF;
        buf[6] = rotation + 1;
        buf[7] = (angle >> 0) & 0XFF;
        pins.i2cWriteBuffer(i2cAddr, buf);
        delayMs(4); // due to bug in ???
        if (isDelay)
            motorDelay(0.5, Mode.Second)
    }

    export function _start(motor: Motor, rotation: Spin, speed: number): void {
        let buf = pins.createBuffer(8)
        buf[0] = 0xFF;
        buf[1] = 0xF9;
        buf[2] = motor + 1;
        buf[3] = rotation + 1;
        buf[4] = 0x60;
        buf[5] = Math.floor(speed);
        buf[6] = 0xF5;
        buf[7] = 0x00;
        pins.i2cWriteBuffer(i2cAddr, buf);
    }

    export function _stop(motor: Motor): void {
        let buf = pins.createBuffer(8)
        buf[0] = 0xFF;
        buf[1] = 0xF9;
        buf[2] = motor + 1;
        buf[3] = 0x00;
        buf[4] = 0x5F;
        buf[5] = 0x00;
        buf[6] = 0xF5;
        buf[7] = 0x00;
        pins.i2cWriteBuffer(i2cAddr, buf);
    }

    export function _readSpeed(motor: Motor): number {
        delayMs(4)
        let buf = pins.createBuffer(8)
        buf[0] = 0xFF;
        buf[1] = 0xF9;
        buf[2] = motor + 1;
        buf[3] = 0x00;
        buf[4] = 0x47;
        buf[5] = 0x00;
        buf[6] = 0xF5;
        buf[7] = 0x00;
        pins.i2cWriteBuffer(i2cAddr, buf);
        delayMs(4)
        let arr = pins.i2cReadBuffer(i2cAddr, 2);
        let retData = (arr[1] << 8) | (arr[0]);
        return Math.floor(retData / 3.6) * 0.01;
    }

    export function _readAngle(motor: Motor): number {
        delayMs(4)
        let buf = pins.createBuffer(8);
        buf[0] = 0xFF;
        buf[1] = 0xF9;
        buf[2] = motor + 1;
        buf[3] = 0x00;
        buf[4] = 0x46;
        buf[5] = 0x00;
        buf[6] = 0xF5;
        buf[7] = 0x00;
        pins.i2cWriteBuffer(i2cAddr, buf);
        delayMs(4)
        let arr = pins.i2cReadBuffer(i2cAddr, 4);
        return (arr[3] << 24) | (arr[2] << 16) | (arr[1] << 8) | (arr[0]);
    }

    export function _absAngle(motor: Motor): number {
        let position = _readAngle(motor)
        while (position < 0) {
            position += 3600;
        }
        return (position % 3600) * 0.1;
    }

    export function _setRelAngleNullPos(motor: Motor) {
        relAngleArr[motor] = _readAngle(motor);
    }

    export function _relAngle(motor: Motor): number {
        return (_readAngle(motor) - relAngleArr[motor]) * 0.1;
    }

    export function _setServoSpeed(speed: number): void {
        if (speed < 0) speed = 0;
        speed *= 9;
        servoSpeedGlobal = speed;
        let buf = pins.createBuffer(8)
        buf[0] = 0xFF;
        buf[1] = 0xF9;
        buf[2] = 0x00;
        buf[3] = 0x00;
        buf[4] = 0x77;
        buf[5] = (speed >> 8) & 0XFF;
        buf[6] = 0x00;
        buf[7] = (speed >> 0) & 0XFF;
        pins.i2cWriteBuffer(i2cAddr, buf);
    }

    export function _reset(motor: Motor): void {
        let buf = pins.createBuffer(8)
        buf[0] = 0xFF;
        buf[1] = 0xF9;
        buf[2] = motor + 1;
        buf[3] = 0x00;
        buf[4] = 0x1D;
        buf[5] = 0x00;
        buf[6] = 0xF5;
        buf[7] = 0x00;
        pins.i2cWriteBuffer(i2cAddr, buf);
        relAngleArr[motor - 1] = 0;
        motorDelay(1, Mode.Second)
    }

    export function _version(): string {
        let buf = pins.createBuffer(8);
        buf[0] = 0xFF;
        buf[1] = 0xF9;
        buf[2] = 0x00;
        buf[3] = 0x00;
        buf[4] = 0x88;
        buf[5] = 0x00;
        buf[6] = 0x00;
        buf[7] = 0x00;
        pins.i2cWriteBuffer(i2cAddr, buf);
        let version = pins.i2cReadBuffer(i2cAddr, 3);
        return `V ${version[0]}.${version[1]}.${version[2]}`;
    }


    // MOTOR MODULE

    export function setLeftMotor(motor: Motor, revert: boolean) {
        Motors[0] = motor
        Revert[0] = revert
    }

    export function setRightMotor(motor: Motor, revert: boolean) {
        Motors[1] = motor
        Revert[1] = revert
    }

    export function setFrontLeftMotor(motor: Motor, revert: boolean) {
        Motors[0] = motor
        Revert[0] = revert
    }

    export function setFrontRightMotor(motor: Motor, revert: boolean) {
        Motors[1] = motor
        Revert[1] = revert
    }

    export function setRearLeftMotor(motor: Motor, revert: boolean) {
        Motors[2] = motor
        Revert[2] = revert
    }

    export function setRearRightMotor(motor: Motor, revert: boolean) {
        Motors[3] = motor
        Revert[3] = revert
    }

    // speed in %
    export function motorSpeed(motor: Motor, speed: number): void {
        _start( motor, speed >= 0 ? Spin.Clockwise : Spin.AntiClockwise, speed)
    }

    // speed in %
    export function fourWheelSpeed(frontleft: number, frontright: number, backleft: number, backright: number) {
        // supply positive values to obtain 'forward' spinning
        motorSpeed(Motors[MFL], Revert[MFL] ? -frontleft : frontleft)
        motorSpeed(Motors[MFR], Revert[MFR] ? -frontright : frontright)
        motorSpeed(Motors[MRL], Revert[MRL] ? -backleft : backleft)
        motorSpeed(Motors[MRR], Revert[MRR] ? -backright : backright)
    }

    // speed in %
    export function twoWheelSpeed(left: number, right: number) {
        // supply positive values to obtain 'forward' spinning
        motorSpeed(Motors[MFL], Revert[MFL] ? -left : left)
        motorSpeed(Motors[MFR], Revert[MFR] ? -right : right)
    }

    // angle in degrees
    export function motorAngle(motor: Motor, rotation: Spin, angle: number, speed: number = 100): void {
        _setServoSpeed(speed)
        _turnToAngle(motor, rotation, angle)
    }

    // angle in degrees
    export function getMotorAngle(motor: Motor): number {
        return _absAngle(motor)
    }

    // SERVO MODULE

    let Servos = [AnalogPin.P0, AnalogPin.P0, AnalogPin.P0, AnalogPin.P0]

    export function setServo(servo: Servo, port: RJPort, line: RJLine) {
        Servos[servo] = analogPin(port, line)
    }

    // angle in degrees
    export function servoAngle(servo: Servo, angle: number): void {
        pins.servoWritePin(Servos[servo], angle)
    }
}

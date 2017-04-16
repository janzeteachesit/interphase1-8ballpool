var Aquaplane = {};

Aquaplane.Preloader = function () {};

Aquaplane.Preloader.prototype = {

    init: function () {

        this.input.maxPointers = 1;

        this.scale.pageAlignHorizontally = true;

    },

    preload: function () {

        this.load.path = 'assets/';

        this.load.bitmapFont('fat-and-tiny');
        this.load.bitmapFont('interfont');

        this.load.images([ 'logo', 'boat', 'skier', 'pole', 'rock', 'shark', 'sea' ]);
        this.load.spritesheet('waves', 'waves.png', 16, 6);

    },

    create: function () {

        this.state.start('Aquaplane.MainMenu');

    }

};

Aquaplane.MainMenu = function () {};

Aquaplane.MainMenu.prototype = {

    create: function () {

        this.add.image(0, 0, 'sea');

        var logo = this.add.image(this.world.centerX, 200, 'logo');
        logo.anchor.x = 0.5;

        var start = this.add.bitmapText(this.world.centerX, 460, 'fat-and-tiny', 'CLICK TO PLAY', 64);
        start.anchor.x = 0.5;
        start.smoothed = false;
        start.tint = 0xff0000;

        this.input.onDown.addOnce(this.start, this);

    },

    start: function () {

        this.state.start('Aquaplane.Game');

    }

};

Aquaplane.Game = function (game) {

    this.score = 0;
    this.scoreText = null;

    this.lives = 3;
    this.livesText = null;

    this.speed = 420;
    this.lastKey = 0;
    this.ready = false;

    this.layer = null;
    this.itemDist = ['pole', 'pole', 'pole', 'rock', 'rock', 'rock', 'shark'];

    this.boat = null;
    this.skier = null;
    this.rope = null;

    this.timer = null;
    this.itemInterval = { count: 0, min: 500, max: 1500 };

    this.pauseKey = null;
    this.debugKey = null;
    this.showDebug = false;

};

Aquaplane.Game.prototype = {

    init: function () {

        this.score = 0;
        this.lives = 3;
        this.speed = 420;

        this.ready = false;
        this.lastKey = 0;

        this.timer = this.time.create(false);
        this.itemInterval = { count: 0, min: 500, max: 1500 };

        this.physics.startSystem(Phaser.Physics.P2JS);
        this.physics.p2.gravity.y = 0;

        this.showDebug = false;

    },

    create: function () {

        this.add.image(0, 0, 'sea');

        this.waterParticle = this.make.bitmapData(2, 2);
        this.waterParticle.rect(0, 0, 2, 2, '#ffffff');
        this.waterParticle.update();

        this.emitter = this.add.emitter(0, 0, 128);
        this.emitter.makeParticles(this.waterParticle);

        this.emitter.gravity = 0;
        this.emitter.setXSpeed(-100, -250);
        this.emitter.setYSpeed(-100, 100);

        this.emitter.setAlpha(1, 0.2, 500);

        this.emitter.flow(500, 20, 2, -1, true);

        this.layer = this.add.group();

        this.boat = this.layer.create(0, 0, 'boat');

        this.physics.p2.enable(this.boat, false);

        this.boat.body.mass = 1;
        this.boat.body.damping = 0.5;
        this.boat.body.fixedRotation = true;
        this.boat.body.collideWorldBounds = false;

        this.skier = this.layer.create(0, 0, 'skier');

        this.physics.p2.enable(this.skier, false);

        this.skier.body.mass = 0.05;
        this.skier.body.damping = 0.5;
        this.skier.body.fixedRotation = true;
        this.skier.body.collideWorldBounds = false;

        this.boatBounds = new Phaser.Rectangle(0, 0, 60, 10);
        this.skierBounds = new Phaser.Rectangle(0, 0, 30, 8);

        var rev = new p2.RevoluteConstraint(this.boat.body.data, this.skier.body.data, {
                localPivotA: [9, 0],
                localPivotB: [2, 0],
                collideConnected: false
            });

        this.physics.p2.world.addConstraint(rev);

        rev.setLimits(this.math.degToRad(-40), this.math.degToRad(40));

        rev.setStiffness(2.0);

        //  Let's create some waves (harmless eye candy)
        //  
        //  Divide screen vertically into 520px / 8 layers = 65px per layer
        //  Place 8 waves per layer (8*8 total)

        var area = new Phaser.Rectangle(0, 80, this.game.width, 65);

        for (var i = 1; i <= 8; i++)
        {
            for (var w = 0; w < 8; w++)
            {
                var wave = this.layer.create(area.randomX, area.randomY, 'waves', this.rnd.between(0, 2));
                wave.anchor.y = -1.5;
                this.physics.arcade.enable(wave);
                wave.body.velocity.x = -120 + (i * -30);
            }

            area.y += 65;
        }

        this.line = new Phaser.Line(this.boat.x - 28, this.boat.y, this.skier.x + 6, this.skier.y - 1);

        //  The rope that attaches the water skier to the boat
        this.rope = this.add.graphics(0, 0);

        this.scoreText = this.add.bitmapText(16, 0, 'fat-and-tiny', 'SCORE: 0', 32);
        this.scoreText.smoothed = false;

        this.livesText = this.add.bitmapText(680, 0, 'fat-and-tiny', 'LIVES: ' + this.lives, 32);
        this.livesText.smoothed = false;

        this.cursors = this.input.keyboard.createCursorKeys();

        //  Press P to pause and resume the game
        this.pauseKey = this.input.keyboard.addKey(Phaser.Keyboard.P);
        this.pauseKey.onDown.add(this.togglePause, this);

        //  Press D to toggle the debug display
        this.debugKey = this.input.keyboard.addKey(Phaser.Keyboard.D);
        this.debugKey.onDown.add(this.toggleDebug, this);

        this.bringBoatOn();

    },

    togglePause: function () {

        this.game.paused = (this.game.paused) ? false : true;

    },

    toggleDebug: function () {

        this.showDebug = (this.showDebug) ? false : true;

    },

    bringBoatOn: function () {

        this.ready = false;

        this.boat.body.x = -64;
        this.boat.body.y = 300;

        this.skier.visible = true;
        this.skier.body.x = -264;
        this.skier.body.y = 300;

        this.boat.body.velocity.x = 300;

    },

    boatReady: function () {

        this.ready = true;
        
        this.boat.body.setZeroVelocity();

        this.timer.add(this.itemInterval.max, this.releaseItem, this);
        this.timer.start();

    },

    releaseItem: function (x, y) {

        if (x === undefined) { x = 800; }
        if (y === undefined) { y = this.rnd.between(80, 487); }

        var frame = this.rnd.pick(this.itemDist);

        var item = this.layer.getFirstDead(true, x, y, frame);
        
        this.physics.arcade.enable(item);

        if (frame === 'shark')
        {
            item.body.setSize(32, 14, 0, 16);
        }
        else
        {
            item.body.setSize(16, 8, 0, 24);
        }

        var i = this.math.snapToFloor(y, 65) / 65;

        item.body.velocity.x = -120 + (i * -30);

        this.itemInterval.count++;

        //  Every 10 new items we'll speed things up a bit
        if (this.itemInterval.min > 100 && this.itemInterval.count % 10 === 0)
        {
            this.itemInterval.min -= 10;
            this.itemInterval.max -= 10;
        }

        //  Is the player idle? Then release another item directly towards them
        if ((this.time.time - this.lastKey) > 200)
        {
            this.lastKey = this.time.time;
            this.releaseItem(800, this.skier.y - 16);
        }
        else
        {
            this.timer.add(this.rnd.between(this.itemInterval.min, this.itemInterval.max), this.releaseItem, this);
        }

    },

    update: function () {

        this.layer.sort('y', Phaser.Group.SORT_ASCENDING);

        if (this.ready)
        {
            this.updateBoat();

            //  Score based on their position on the screen
            this.score += (this.math.snapToFloor(this.skier.y, 65) / 65);
            this.scoreText.text = "SCORE: " + this.score;
        }
        else
        {
            if (this.skier.visible)
            {
                if (this.boat.x >= 250)
                {
                    this.boatReady();
                }
            }
            else
            {
                if (this.boat.x >= 832)
                {
                    this.bringBoatOn();
                }
            }
        }

        this.boatBounds.centerOn(this.boat.x + 4, this.boat.y + 8);
        this.skierBounds.centerOn(this.skier.x + 2, this.skier.y + 10);

        this.emitter.emitX = this.boat.x - 16;
        this.emitter.emitY = this.boat.y + 10;

        //  Let's sort and collide
        this.layer.forEachAlive(this.checkItem, this);

    },

    updateBoat: function () {

        if (this.boat.x < 200)
        {
            this.boat.body.setZeroForce();
            this.boat.body.x = 200;
        }
        else if (this.boat.x > 750)
        {
            this.boat.body.setZeroForce();
            this.boat.body.x = 750;
        }

        if (this.boat.y < 100)
        {
            this.boat.body.setZeroForce();
            this.boat.body.y = 100;
        }
        else if (this.boat.y > 550)
        {
            this.boat.body.setZeroForce();
            this.boat.body.y = 550;
        }

        if (this.cursors.left.isDown)
        {
            this.boat.body.force.x = -this.speed;
            this.lastKey = this.time.time;
        }
        else if (this.cursors.right.isDown)
        {
            this.boat.body.force.x = this.speed;
            this.lastKey = this.time.time;
        }

        if (this.cursors.up.isDown)
        {
            this.boat.body.force.y = -this.speed;
            this.lastKey = this.time.time;
        }
        else if (this.cursors.down.isDown)
        {
            this.boat.body.force.y = this.speed;
            this.lastKey = this.time.time;
        }

    },

    checkItem: function (item) {

        if (item === this.boat || item === this.skier)
        {
            return;
        }

        if (item.x < -32)
        {
            if (item.key === 'waves')
            {
                item.x = this.rnd.between(800, 864);
            }
            else
            {
                item.kill();
            }
        }
        else
        {
            //   Check for collision
            if (this.ready && item.key !== 'waves' && this.skierBounds.intersects(item.body))
            {
                this.loseLife();
            }
        }

    },

    loseLife: function () {

        if (this.lives === 0)
        {
            this.gameOver();
        }
        else
        {
            this.lives--;

            this.livesText.text = "LIVES: " + this.lives;

            this.ready = false;

            //  Kill the surfer!
            this.skier.visible = false;

            //  Hide the rope
            this.rope.clear();

            //  Speed the boat away
            this.boat.body.setZeroVelocity();
            this.boat.body.velocity.x = 600;

            this.itemInterval.min += 200;
            this.itemInterval.max += 200;
        }

    },

    gameOver: function () {

        this.state.start('Aquaplane.MainMenu');

    },

    preRender: function () {

        this.line.setTo(this.boat.x - 28, this.boat.y, this.skier.x + 6, this.skier.y - 1);

        if (this.skier.visible)
        {
            this.rope.clear();
            this.rope.lineStyle(1, 0xffffff, 1);
            this.rope.moveTo(this.line.start.x, this.line.start.y);
            this.rope.lineTo(this.line.end.x, this.line.end.y);
            this.rope.endFill();
        }

    },

    render: function () {

        if (this.showDebug)
        {
            this.game.debug.geom(this.boatBounds);
            this.game.debug.geom(this.skierBounds);
            this.layer.forEachAlive(this.renderBody, this);
            this.game.debug.geom(this.skier.position, 'rgba(255,255,0,1)');
        }

    },

    renderBody: function (sprite) {

        if (sprite === this.boat || sprite === this.skier || sprite.key === 'waves')
        {
            return;
        }

        this.game.debug.body(sprite);

    }

};

var game = new Phaser.Game(800, 600, Phaser.AUTO, 'game');

game.state.add('Aquaplane.Preloader', Aquaplane.Preloader);
game.state.add('Aquaplane.MainMenu', Aquaplane.MainMenu);
game.state.add('Aquaplane.Game', Aquaplane.Game);

game.state.start('Aquaplane.Preloader');

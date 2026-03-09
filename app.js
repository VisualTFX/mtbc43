        // --- Custom Cursor Logic ---
        const cursorInner = document.getElementById('cursor-inner');
        const cursorOuter = document.getElementById('cursor-outer');
        
        // Track positions
        let mouseX = window.innerWidth / 2;
        let mouseY = window.innerHeight / 2;
        let outerX = mouseX;
        let outerY = mouseY;
        let innerX = mouseX;
        let innerY = mouseY;

        // Listen for mouse movement
        window.addEventListener('mousemove', (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
        });

        // Render loop for smooth trailing effect
        function renderCursor() {
            // Inner follows instantly
            innerX = mouseX;
            innerY = mouseY;
            
            // Outer follows with lerp (linear interpolation) delay
            outerX += (mouseX - outerX) * 0.15;
            outerY += (mouseY - outerY) * 0.15;

            // Apply transforms (using translate3d for hardware acceleration)
            cursorInner.style.transform = `translate3d(${innerX}px, ${innerY}px, 0) translate(-50%, -50%)`;
            cursorOuter.style.transform = `translate3d(${outerX}px, ${outerY}px, 0) translate(-50%, -50%)`;

            requestAnimationFrame(renderCursor);
        }
        renderCursor();

        // Add hover effects globally via event delegation
        document.addEventListener('mouseover', (e) => {
            const interactiveElement = e.target.closest('button, a, input, [onclick], .cursor-pointer');
            if (interactiveElement) {
                cursorInner.classList.add('hover');
                cursorOuter.classList.add('hover');
            }
        });

        document.addEventListener('mouseout', (e) => {
            const interactiveElement = e.target.closest('button, a, input, [onclick], .cursor-pointer');
            if (interactiveElement) {
                cursorInner.classList.remove('hover');
                cursorOuter.classList.remove('hover');
            }
        });


        // --- Visual Settings ---
        const settings = {
            darkMode: true,
            particlesEnabled: true,
            particleStrength: 1,
            gradientCustomizer: false,
            gradientColors: ['#4c1d95', '#0ea5e9', '#e11d48']
        };

        try {
            const savedVisuals = localStorage.getItem('mtw_visual_settings');
            if (savedVisuals) Object.assign(settings, JSON.parse(savedVisuals));
        } catch (e) {}

        const settingsToggle = document.getElementById('settings-toggle');
        const settingsPanel = document.getElementById('settings-panel');
        const modeToggle = document.getElementById('mode-toggle');
        const particlesToggle = document.getElementById('particles-toggle');
        const particleStrengthInput = document.getElementById('particle-strength');
        const gradientToggle = document.getElementById('gradient-toggle');
        const gradientControls = document.getElementById('gradient-controls');
        const gradientColourList = document.getElementById('gradient-colour-list');
        const addGradientColorBtn = document.getElementById('add-gradient-color');
        const removeGradientColorBtn = document.getElementById('remove-gradient-color');

        function persistVisualSettings() {
            try { localStorage.setItem('mtw_visual_settings', JSON.stringify(settings)); } catch (e) {}
        }

        function applyVisualTheme() {
            document.body.classList.toggle('light-mode', !settings.darkMode);
            modeToggle.checked = settings.darkMode;
            particlesToggle.checked = settings.particlesEnabled;
            particleStrengthInput.value = settings.particleStrength;
            gradientToggle.checked = settings.gradientCustomizer;
            gradientControls.classList.toggle('hidden', !settings.gradientCustomizer);

            const effective = settings.gradientCustomizer ? settings.gradientColors : ['#4c1d95', '#0ea5e9', '#e11d48', '#7c3aed', '#2563eb'];
            const root = document.documentElement.style;
            for (let i = 0; i < 5; i++) {
                root.setProperty(`--grad-${i + 1}`, effective[i % effective.length]);
            }
            root.setProperty('--title-grad-a', effective[0]);
            root.setProperty('--title-grad-b', effective[Math.min(1, effective.length - 1)] || effective[0]);

            renderGradientInputs();
            persistVisualSettings();
        }

        function renderGradientInputs() {
            gradientColourList.innerHTML = '';
            settings.gradientColors.forEach((color, index) => {
                const row = document.createElement('label');
                row.className = 'flex items-center justify-between gap-3 text-xs';
                row.innerHTML = `<span>Colour ${index + 1}</span><input type="color" value="${color}" data-index="${index}" class="h-8 w-16 rounded bg-transparent border border-white/20">`;
                gradientColourList.appendChild(row);
            });
        }

        settingsToggle.addEventListener('click', () => {
            settingsPanel.classList.toggle('hidden');
        });
        modeToggle.addEventListener('change', (e) => { settings.darkMode = e.target.checked; applyVisualTheme(); });
        particlesToggle.addEventListener('change', (e) => { settings.particlesEnabled = e.target.checked; applyVisualTheme(); });
        particleStrengthInput.addEventListener('input', (e) => { settings.particleStrength = Number(e.target.value); applyVisualTheme(); rebuildParticles(); });
        gradientToggle.addEventListener('change', (e) => { settings.gradientCustomizer = e.target.checked; applyVisualTheme(); });

        addGradientColorBtn.addEventListener('click', () => {
            if (settings.gradientColors.length >= 5) return;
            const last = settings.gradientColors[settings.gradientColors.length - 1] || '#60a5fa';
            settings.gradientColors.push(last);
            applyVisualTheme();
        });

        removeGradientColorBtn.addEventListener('click', () => {
            if (settings.gradientColors.length <= 2) return;
            settings.gradientColors.pop();
            applyVisualTheme();
        });

        gradientColourList.addEventListener('input', (e) => {
            if (e.target.matches('input[type="color"]')) {
                const idx = Number(e.target.dataset.index);
                settings.gradientColors[idx] = e.target.value;
                applyVisualTheme();
            }
        });

        // --- Particle Field ---
        const particleCanvas = document.getElementById('particle-canvas');
        const pctx = particleCanvas.getContext('2d');
        let phoneObstacles = [];
        let isHolding = false;
        const particles = [];

        function hexToRgb(hex) {
            const clean = hex.replace('#', '');
            const n = parseInt(clean, 16);
            return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
        }

        function mixGradientColor() {
            const colors = settings.gradientCustomizer ? settings.gradientColors : ['#4c1d95', '#0ea5e9', '#e11d48', '#7c3aed', '#2563eb'];
            const c1 = hexToRgb(colors[Math.floor(Math.random() * colors.length)]);
            const c2 = hexToRgb(colors[Math.floor(Math.random() * colors.length)]);
            const t = Math.random();
            return `rgba(${Math.round(c1.r + (c2.r - c1.r) * t)}, ${Math.round(c1.g + (c2.g - c1.g) * t)}, ${Math.round(c1.b + (c2.b - c1.b) * t)}, 0.85)`;
        }

        function resizeParticleCanvas() {
            particleCanvas.width = window.innerWidth;
            particleCanvas.height = window.innerHeight;
        }

        function rebuildParticles() {
            particles.length = 0;
            const count = Math.round(220 * settings.particleStrength);
            for (let i = 0; i < count; i++) {
                particles.push({
                    x: Math.random() * particleCanvas.width,
                    y: Math.random() * particleCanvas.height,
                    vx: (Math.random() - 0.5) * 1.2,
                    vy: (Math.random() - 0.5) * 1.2,
                    size: 1 + Math.random() * 2.2,
                    color: mixGradientColor()
                });
            }
        }

        function explodeParticles() {
            particles.forEach((p) => {
                const angle = Math.random() * Math.PI * 2;
                const speed = (2 + Math.random() * 7) * settings.particleStrength;
                p.vx = Math.cos(angle) * speed;
                p.vy = Math.sin(angle) * speed;
            });
        }

        window.addEventListener('mousedown', () => { isHolding = true; });
        window.addEventListener('mouseup', () => {
            if (isHolding) explodeParticles();
            isHolding = false;
        });

        function updateAndDrawParticles() {
            pctx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
            if (!settings.particlesEnabled) return;

            for (const p of particles) {
                if (isHolding) {
                    const dx = mouseX - p.x;
                    const dy = mouseY - p.y;
                    p.vx += dx * 0.012 * settings.particleStrength;
                    p.vy += dy * 0.012 * settings.particleStrength;
                    p.vx *= 0.74;
                    p.vy *= 0.74;
                } else {
                    p.vx *= 0.992;
                    p.vy *= 0.992;
                    p.vx += (Math.random() - 0.5) * 0.02;
                    p.vy += (Math.random() - 0.5) * 0.02;
                }

                p.x += p.vx;
                p.y += p.vy;

                if (p.x < 0 || p.x > particleCanvas.width) p.vx *= -0.9;
                if (p.y < 0 || p.y > particleCanvas.height) p.vy *= -0.9;
                p.x = Math.max(0, Math.min(particleCanvas.width, p.x));
                p.y = Math.max(0, Math.min(particleCanvas.height, p.y));

                for (const obstacle of phoneObstacles) {
                    const dx = p.x - obstacle.x;
                    const dy = p.y - obstacle.y;
                    const dist = Math.hypot(dx, dy);
                    const minDist = obstacle.r + p.size;
                    if (dist < minDist) {
                        const nx = dx / (dist || 1);
                        const ny = dy / (dist || 1);
                        p.x = obstacle.x + nx * minDist;
                        p.y = obstacle.y + ny * minDist;
                        const dot = p.vx * nx + p.vy * ny;
                        p.vx = (p.vx - 2 * dot * nx) * 0.8;
                        p.vy = (p.vy - 2 * dot * ny) * 0.8;
                    }
                }

                pctx.fillStyle = p.color;
                pctx.beginPath();
                pctx.arc(p.x, p.y, p.size * (isHolding ? 1.3 : 1), 0, Math.PI * 2);
                pctx.fill();
            }
        }

        resizeParticleCanvas();
        applyVisualTheme();
        rebuildParticles();



        // --- Core Routing ---
        lucide.createIcons();
        function navigate(pageId) {
            document.querySelectorAll('.page-section').forEach(el => el.classList.remove('active'));
            const target = document.getElementById(pageId);
            if(target) {
                target.classList.add('active');
                window.scrollTo({ top: 0, behavior: 'smooth' });
                
                if(pageId === 'locations' && !isMapLoaded) {
                    initializeMapFeatures();
                }
            }
        }

        // --- Store Locations & Leaflet Logic ---
        let isMapLoaded = false;
        let leafletMap;
        let mapMarkers = [];
        
        const storeLocations = [
            { name: "London Flagship", address: "142 Oxford Street, London", phone: "020 7946 0010", lat: 51.5149, lng: -0.1446 },
            { name: "Manchester Central", address: "Arndale Centre, Manchester", phone: "0161 496 0221", lat: 53.4831, lng: -2.2440 },
            { name: "Edinburgh Hub", address: "45 Princes Street, Edinburgh", phone: "0131 496 0332", lat: 55.9533, lng: -3.1989 },
            { name: "Birmingham Bullring", address: "Moor Street, Birmingham", phone: "0121 496 0443", lat: 52.4776, lng: -1.8950 },
            { name: "Cardiff Bay", address: "St David's Dewi Sant, Cardiff", phone: "029 2018 0554", lat: 51.4800, lng: -3.1750 }
        ];

        function initializeMapFeatures() {
            if(isMapLoaded) return;

            leafletMap = L.map('gmap-container', {
                zoomControl: true,
                attributionControl: true
            }).setView([53.5, -2.0], 6);

            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                subdomains: 'abcd',
                maxZoom: 19,
                attribution: '&copy; OpenStreetMap &copy; CARTO'
            }).addTo(leafletMap);

            const listContainer = document.getElementById('store-list-container');
            listContainer.innerHTML = '';

            storeLocations.forEach((store, index) => {
                listContainer.innerHTML += `
                    <div onclick="focusStore(${index})" class="glass-card p-5 cursor-pointer hover:bg-white/10 transition group border-l-4 border-l-transparent hover:border-l-blue-400">
                        <div class="flex justify-between items-start">
                            <div>
                                <h3 class="text-lg font-bold text-white group-hover:text-blue-400 transition">${store.name}</h3>
                                <p class="text-gray-400 text-sm flex items-center gap-1 mt-2"><i data-lucide="map-pin" class="w-3.5 h-3.5"></i> ${store.address}</p>
                                <p class="text-gray-500 text-xs flex items-center gap-1 mt-1"><i data-lucide="phone" class="w-3.5 h-3.5"></i> ${store.phone}</p>
                            </div>
                            <div class="bg-blue-500/20 p-2 rounded-full text-blue-400 opacity-0 group-hover:opacity-100 transition"><i data-lucide="navigation" class="w-4 h-4"></i></div>
                        </div>
                    </div>
                `;

                const marker = L.circleMarker([store.lat, store.lng], {
                    radius: 9,
                    color: '#ffffff',
                    weight: 2,
                    fillColor: '#3b82f6',
                    fillOpacity: 0.95
                }).addTo(leafletMap);

                const popupContent = `
                    <div style="padding: 4px; min-width: 150px; cursor: none;">
                        <h3 style="font-weight: bold; font-size: 16px; margin-bottom: 4px; color: white;">${store.name}</h3>
                        <p style="font-size: 13px; color: #a0aec0; margin: 0;">${store.address}</p>
                        <p style="font-size: 13px; color: #60a5fa; margin-top: 4px; font-weight: 600;">${store.phone}</p>
                    </div>
                `;

                marker.bindPopup(popupContent);
                marker.on('click', () => {
                    closeAllInfoWindows();
                    marker.openPopup();
                    leafletMap.setView([store.lat, store.lng], 14, { animate: true });
                });

                mapMarkers.push({ marker, ...store });
            });

            isMapLoaded = true;
            lucide.createIcons();
        }

        function closeAllInfoWindows() {
            mapMarkers.forEach(item => item.marker.closePopup());
        }

        function focusStore(index) {
            const store = mapMarkers[index];
            if(leafletMap) {
                closeAllInfoWindows();
                leafletMap.flyTo([store.lat, store.lng], 15, { duration: 0.8 });
                setTimeout(() => store.marker.openPopup(), 350);
            }
        }

        function submitContactForm(event) {
            event.preventDefault();
            event.target.reset();
            showToast('Your message has been sent. Our team will contact you shortly!', 'mail-check');
        }


        // --- Application State ---
        let cart = [];
        let currentUser = null;
        let usersDB = [];

        try {
            const savedCart = localStorage.getItem('mtw_cart');
            if (savedCart) cart = JSON.parse(savedCart);
            
            const savedUsers = localStorage.getItem('mtw_users');
            if (savedUsers) usersDB = JSON.parse(savedUsers);
            
            const activeUser = localStorage.getItem('mtw_active_user');
            if (activeUser) currentUser = JSON.parse(activeUser);
        } catch(e) {}

        function showToast(message, icon = 'check') {
            const container = document.getElementById('toast-container');
            const toast = document.createElement('div');
            toast.className = 'toast';
            toast.innerHTML = `<i data-lucide="${icon}" class="text-green-400 w-5 h-5"></i> <span>${message}</span>`;
            container.appendChild(toast);
            lucide.createIcons();
            setTimeout(() => { if(toast.parentNode) toast.remove(); }, 3000);
        }

        function saveCart() {
            try { localStorage.setItem('mtw_cart', JSON.stringify(cart)); } catch(e){}
            updateCartUI();
        }

        function addToCart(id, name, price, image, type) {
            const existing = cart.find(item => item.id === id);
            if(existing) {
                existing.quantity += 1;
            } else {
                cart.push({ id, name, price, image, type, quantity: 1 });
            }
            saveCart();
            showToast(`${name} added to cart!`);
        }

        function removeFromCart(id) {
            cart = cart.filter(item => item.id !== id);
            saveCart();
        }

        function updateQuantity(id, change) {
            const item = cart.find(item => item.id === id);
            if(item) {
                item.quantity += change;
                if(item.quantity <= 0) removeFromCart(id);
                else saveCart();
            }
        }

        function updateCartUI() {
            const count = cart.reduce((sum, item) => sum + item.quantity, 0);
            const badge1 = document.getElementById('cart-badge');
            const badge2 = document.getElementById('mobile-cart-badge');
            if(count > 0) {
                badge1.classList.remove('hidden'); badge1.innerText = count;
                badge2.classList.remove('hidden'); badge2.innerText = count;
            } else {
                badge1.classList.add('hidden');
                badge2.classList.add('hidden');
            }

            const container = document.getElementById('cart-items');
            if(cart.length === 0) {
                container.innerHTML = '<p class="text-gray-400 text-center mt-10">Your cart is empty.</p>';
                document.getElementById('cart-oneoff-total').innerText = '£0.00';
                document.getElementById('cart-monthly-total').innerText = '£0.00/mo';
                document.getElementById('cart-final-total').innerText = '£0.00';
                return;
            }

            container.innerHTML = '';
            let oneOffTotal = 0;
            let monthlyTotal = 0;

            cart.forEach(item => {
                if(item.type === 'monthly') monthlyTotal += item.price * item.quantity;
                else oneOffTotal += item.price * item.quantity;

                const priceDisplay = item.type === 'monthly' ? `£${item.price}/mo` : `£${item.price}`;
                const fallbackImg = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" fill="none" stroke="gray"><rect width="100" height="100" rx="10"/></svg>';

                container.innerHTML += `
                    <div class="glass-panel p-3 rounded-xl flex gap-4 items-center relative group cursor-pointer">
                        <img src="${item.image || fallbackImg}" class="w-16 h-16 object-cover rounded-lg bg-black/50">
                        <div class="flex-grow">
                            <h4 class="text-sm font-bold line-clamp-1">${item.name}</h4>
                            <p class="text-blue-400 font-semibold text-sm">${priceDisplay}</p>
                            <div class="flex items-center gap-3 mt-2">
                                <button onclick="updateQuantity('${item.id}', -1)" class="w-6 h-6 bg-white/10 rounded flex items-center justify-center hover:bg-white/20">-</button>
                                <span class="text-sm">${item.quantity}</span>
                                <button onclick="updateQuantity('${item.id}', 1)" class="w-6 h-6 bg-white/10 rounded flex items-center justify-center hover:bg-white/20">+</button>
                            </div>
                        </div>
                        <button onclick="removeFromCart('${item.id}')" class="absolute top-2 right-2 text-gray-500 hover:text-red-400 transition opacity-0 group-hover:opacity-100"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                    </div>
                `;
            });
            lucide.createIcons();

            document.getElementById('cart-oneoff-total').innerText = `£${oneOffTotal.toLocaleString()}`;
            document.getElementById('cart-monthly-total').innerText = `£${monthlyTotal.toLocaleString()}/mo`;
            const dueToday = oneOffTotal + monthlyTotal;
            document.getElementById('cart-final-total').innerText = `£${dueToday.toLocaleString()}`;
            document.getElementById('checkout-total-btn').innerText = `£${dueToday.toLocaleString()}`;
        }

        function toggleCart() {
            const sidebar = document.getElementById('cart-sidebar');
            const backdrop = document.getElementById('cart-backdrop');
            sidebar.classList.toggle('cart-open');
            if(sidebar.classList.contains('cart-open')) {
                backdrop.classList.remove('hidden');
                setTimeout(() => backdrop.classList.remove('opacity-0'), 10);
            } else {
                backdrop.classList.add('opacity-0');
                setTimeout(() => backdrop.classList.add('hidden'), 300);
            }
        }

        function openCheckout() {
            if(cart.length === 0) {
                showToast("Cart is empty!", "alert-circle");
                return;
            }
            if(!currentUser) {
                toggleCart();
                showToast("Please sign in to checkout", "info");
                openAuthModal();
                return;
            }
            toggleCart();
            document.getElementById('checkout-modal').classList.remove('hidden');
            document.getElementById('checkout-modal').classList.add('flex');
        }
        function closeCheckout() {
            document.getElementById('checkout-modal').classList.add('hidden');
            document.getElementById('checkout-modal').classList.remove('flex');
        }
        function processPayment(e) {
            e.preventDefault();
            setTimeout(() => {
                closeCheckout();
                cart = [];
                saveCart();
                showToast("Payment Successful! Order Confirmed.");
            }, 1000);
        }

        function updateAuthUI() {
            const navBtnText = document.getElementById('nav-auth-text');
            if(currentUser) {
                navBtnText.innerText = currentUser.name.split(' ')[0];
            } else {
                navBtnText.innerText = "Sign In";
            }
        }

        function openAuthModal() {
            document.getElementById('auth-modal').classList.remove('hidden');
            document.getElementById('auth-modal').classList.add('flex');
            
            if(currentUser) {
                document.getElementById('login-view').classList.add('hidden');
                document.getElementById('signup-view').classList.add('hidden');
                document.getElementById('profile-view').classList.remove('hidden');
                document.getElementById('profile-name').innerText = currentUser.name;
                document.getElementById('profile-email').innerText = currentUser.email;
            } else {
                document.getElementById('profile-view').classList.add('hidden');
                document.getElementById('signup-view').classList.add('hidden');
                document.getElementById('login-view').classList.remove('hidden');
            }
        }

        function closeAuthModal() {
            document.getElementById('auth-modal').classList.add('hidden');
            document.getElementById('auth-modal').classList.remove('flex');
        }

        function toggleAuthView() {
            const login = document.getElementById('login-view');
            const signup = document.getElementById('signup-view');
            if(login.classList.contains('hidden')) {
                login.classList.remove('hidden');
                signup.classList.add('hidden');
            } else {
                login.classList.add('hidden');
                signup.classList.remove('hidden');
            }
        }

        function handleSignup(e) {
            e.preventDefault();
            const name = document.getElementById('signup-name').value;
            const email = document.getElementById('signup-email').value;
            const pass = document.getElementById('signup-pass').value;

            if(usersDB.find(u => u.email === email)) {
                alert("Email already exists!");
                return;
            }
            usersDB.push({ name, email, pass });
            currentUser = { name, email };
            try {
                localStorage.setItem('mtw_users', JSON.stringify(usersDB));
                localStorage.setItem('mtw_active_user', JSON.stringify(currentUser));
            } catch(e) {}
            closeAuthModal();
            updateAuthUI();
            showToast("Account created successfully!");
            e.target.reset();
        }

        function handleLogin(e) {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const pass = document.getElementById('login-pass').value;

            const user = usersDB.find(u => u.email === email && u.pass === pass);
            if(user) {
                currentUser = { name: user.name, email: user.email };
                try { localStorage.setItem('mtw_active_user', JSON.stringify(currentUser)); } catch(e) {}
                closeAuthModal();
                updateAuthUI();
                showToast(`Welcome back, ${user.name}!`);
                e.target.reset();
            } else {
                alert("Invalid email or password");
            }
        }

        function handleLogout() {
            currentUser = null;
            try { localStorage.removeItem('mtw_active_user'); } catch(e) {}
            closeAuthModal();
            updateAuthUI();
            showToast("Logged out successfully");
        }

        updateCartUI();
        updateAuthUI();

        // --- 3D Scroll Background Logic ---
        const canvas = document.querySelector('#bg-canvas');
        const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.z = 30;

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);

        const dirLight1 = new THREE.DirectionalLight(0x60a5fa, 2);
        dirLight1.position.set(10, 20, 10);
        scene.add(dirLight1);

        const dirLight2 = new THREE.DirectionalLight(0xc084fc, 2);
        dirLight2.position.set(-10, -20, 10);
        scene.add(dirLight2);

        function createPhoneMesh() {
            const group = new THREE.Group();
            const chassisGeo = new THREE.BoxGeometry(4, 8, 0.4);
            const chassisMat = new THREE.MeshPhysicalMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.2 });
            const chassis = new THREE.Mesh(chassisGeo, chassisMat);

            const screenGeo = new THREE.PlaneGeometry(3.6, 7.6);
            const screenMat = new THREE.MeshPhysicalMaterial({ color: 0x050505, metalness: 0.1, roughness: 0.1, transmission: 0.5, opacity: 0.9, transparent: true });
            const screen = new THREE.Mesh(screenGeo, screenMat);
            screen.position.z = 0.21;

            const glowGeo = new THREE.PlaneGeometry(3.6, 7.6);
            const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(Math.random(), 0.8, 0.5), transparent: true, opacity: 0.15 });
            const glow = new THREE.Mesh(glowGeo, glowMat);
            glow.position.z = 0.22;

            group.add(chassis); group.add(screen); group.add(glow);
            return group;
        }

        const objects = [];
        for(let i = 0; i < 18; i++) {
            const mesh = createPhoneMesh();
            const angle = Math.random() * Math.PI * 2;
            const radius = 10 + Math.random() * 10;
            const yPos = (Math.random() - 0.5) * 60;
            
            mesh.position.set(Math.cos(angle) * radius, yPos, Math.sin(angle) * radius - 10);
            mesh.rotation.x = Math.random() * Math.PI;
            mesh.rotation.y = Math.random() * Math.PI;
            
            mesh.userData = { rx: (Math.random() - 0.5) * 0.01, ry: (Math.random() - 0.5) * 0.01, ryBase: yPos };
            scene.add(mesh);
            objects.push(mesh);
        }

        let currentScrollY = window.scrollY;
        let targetScrollY = window.scrollY;
        window.addEventListener('scroll', () => { targetScrollY = window.scrollY; });

        function animate() {
            requestAnimationFrame(animate);
            currentScrollY += (targetScrollY - currentScrollY) * 0.05;
            camera.position.y = -currentScrollY * 0.015;

            phoneObstacles = [];
            objects.forEach(obj => {
                obj.rotation.x += obj.userData.rx;
                obj.rotation.y += obj.userData.ry;
                obj.position.y = obj.userData.ryBase + Math.sin(Date.now() * 0.001 + obj.userData.ryBase) * 1.5;

                const projected = obj.position.clone().project(camera);
                const px = (projected.x * 0.5 + 0.5) * window.innerWidth;
                const py = (-projected.y * 0.5 + 0.5) * window.innerHeight;
                const depth = Math.max(5, camera.position.z - obj.position.z);
                const radius = Math.max(26, Math.min(78, 340 / depth));
                if (projected.z < 1) phoneObstacles.push({ x: px, y: py, r: radius });
            });
            renderer.render(scene, camera);
            updateAndDrawParticles();
        }
        animate();

        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
            resizeParticleCanvas();
            rebuildParticles();
        });
    

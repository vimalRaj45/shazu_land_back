document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById('chatbot-toggle-btn');
  const closeBtn = document.getElementById('chatbot-close-btn');
  const widget = document.getElementById('chatbot-widget');
  const form = document.getElementById('chatbot-form');
  const input = document.getElementById('chatbot-input');
  const messagesContainer = document.getElementById('chatbot-messages');
  const typingIndicator = document.getElementById('chatbot-typing');

  const openChatbot = () => {
    const w = document.getElementById('chatbot-widget') || widget;
    if (!w) return;
    w.classList.remove('hidden');
    document.body.classList.add('chatbot-open');
    setTimeout(() => {
      const inp = document.getElementById('chatbot-input') || input;
      if (inp) inp.focus();
      scrollToBottom();
    }, 100);
  };
  window.openChatbot = openChatbot;

  const closeChatbot = () => {
    const w = document.getElementById('chatbot-widget') || widget;
    if (!w) return;
    w.classList.add('hidden');
    document.body.classList.remove('chatbot-open');
  };
  window.closeChatbot = closeChatbot;

  // Toggle Widget Visibility
  if (toggleBtn && widget) {
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (widget.classList.contains('hidden')) {
        openChatbot();
      } else {
        closeChatbot();
      }
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeChatbot();
    });
  }

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && widget && !widget.classList.contains('hidden')) {
      closeChatbot();
    }
  });

  // Scroll to bottom helper
  const scrollToBottom = () => {
    setTimeout(() => {
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    }, 50);
  };

  // Format simple markdown bold and line breaks
  const formatMessageText = (str) => {
    return str
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  };

  // Add Message bubble helper
  const addMessage = (text, isUser = false) => {
    const messageRow = document.createElement('div');
    messageRow.className = isUser ? 'flex items-start gap-2 justify-end' : 'flex items-start gap-2 max-w-[88%]';
    
    let avatarHtml = '';
    let bubbleClass = '';
    
    if (isUser) {
      bubbleClass = 'bg-[#123B32] text-white px-3.5 py-2.5 rounded-2xl rounded-tr-none shadow-xs leading-relaxed text-xs';
    } else {
      avatarHtml = `
        <div class="w-7 h-7 rounded-lg bg-[#E8EFEB] dark:bg-emerald-950/60 border border-brand-border dark:border-[#334155] flex items-center justify-center flex-shrink-0 text-[#123B32] dark:text-[#a7f3d0]">
          <i class="bi bi-robot"></i>
        </div>
      `;
      bubbleClass = 'bg-white dark:bg-[#1e293b] border border-brand-border dark:border-[#334155] text-brand-darkText dark:text-[#f8fafc] px-3.5 py-2.5 rounded-2xl rounded-tl-none shadow-xs leading-relaxed text-xs';
    }

    const formattedText = formatMessageText(text);

    messageRow.innerHTML = `
      ${!isUser ? avatarHtml : ''}
      <div class="${bubbleClass}">
        ${formattedText}
      </div>
    `;
    messagesContainer.appendChild(messageRow);
    scrollToBottom();
  };

  // Form submission handler
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const query = input.value.trim();
      if (!query) return;

      // Add user message
      addMessage(query, true);
      input.value = '';

      // Show typing indicator
      if (typingIndicator) {
        typingIndicator.classList.remove('hidden');
        scrollToBottom();
      }

      const isSoftwarePage = window.location.pathname.includes('software.html') || document.title.toLowerCase().includes('software');

      const systemPrompt = isSoftwarePage
        ? 'You are the Lead Technical Solutions Assistant for Shazu Soft Software Labs. We engineer custom full-stack web applications (React, Next.js, Node.js, Fastify, PostgreSQL), mobile apps (Flutter, React Native), cloud microservices (AWS, Docker), UI/UX product design, and API architectures with 100% client code ownership and weekly sprint demos. Guide clients on tech stack choices, development timelines, and getting an RFP quote. Answer concisely in 2 to 3 sentences.'
        : 'You are a professional assistant representing Shazu Soft Technologies (SST). SST provides software engineering labs, certified tech internships, faculty AI training, and scientific research publication support in Salem and Namakkal, Tamil Nadu. Answer queries professionally in 2 to 3 sentences.';

      try {
        const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer VKq0u5M7BqZBeefYmP29yT1bUnPUMaBD'
          },
          body: JSON.stringify({
            model: 'open-mistral-7b',
            messages: [
              {
                role: 'system',
                content: systemPrompt
              },
              {
                role: 'user',
                content: query
              }
            ]
          })
        });

        if (!response.ok) {
          throw new Error('API returned an error code');
        }

        const data = await response.json();
        const reply = data.choices[0].message.content;
        
        // Hide typing indicator
        if (typingIndicator) typingIndicator.classList.add('hidden');
        
        // Add bot message
        addMessage(reply, false);
      } catch (err) {
        console.error('Chatbot API error:', err);
        // Hide typing indicator
        if (typingIndicator) typingIndicator.classList.add('hidden');
        
        // Context-aware fallback responses
        const softwareFallbacks = [
          "Shazu Soft Software Labs builds custom web platforms, mobile apps, and cloud backend microservices with 100% client code ownership and transparent weekly sprint demos. You can submit an RFP on this page or WhatsApp us at +91 93616 80077.",
          "We develop full-stack applications using React, Next.js, Node.js, Fastify, PostgreSQL, Flutter, and AWS cloud infrastructure tailored to your exact business workflow.",
          "Our software engineering projects typically follow agile 2-to-8 week sprints with direct access to lead developers and full IP handover. Feel free to use our Estimator tool or request a technical proposal!"
        ];

        const genericFallbacks = [
          "Thank you for your interest! Shazu Soft Technologies offers software development, AI internships, and academic research consulting. Reach our Salem team at +91 93616 80077 or email info@shazusofttechnologies.org.",
          "Our Salem address: 2nd Agraharam, Chairman Rajarathinam Street, Near Kamala Hospital, Salem - 636001. We are open Mon-Sat 9AM-6PM.",
          "We offer student internships, institutional faculty development, and custom enterprise engineering solutions."
        ];

        const fallbacks = isSoftwarePage ? softwareFallbacks : genericFallbacks;
        const randomReply = fallbacks[Math.floor(Math.random() * fallbacks.length)];
        addMessage(randomReply, false);
      }
    });
  }
});

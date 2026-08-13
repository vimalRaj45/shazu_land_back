document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById('chatbot-toggle-btn');
  const closeBtn = document.getElementById('chatbot-close-btn');
  const widget = document.getElementById('chatbot-widget');
  const form = document.getElementById('chatbot-form');
  const input = document.getElementById('chatbot-input');
  const messagesContainer = document.getElementById('chatbot-messages');
  const typingIndicator = document.getElementById('chatbot-typing');

  // Toggle Widget Visibility
  if (toggleBtn && widget) {
    toggleBtn.addEventListener('click', () => {
      widget.classList.toggle('hidden');
      if (!widget.classList.contains('hidden')) {
        input.focus();
        scrollToBottom();
      }
    });
  }

  if (closeBtn && widget) {
    closeBtn.addEventListener('click', () => {
      widget.classList.add('hidden');
    });
  }

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
                content: 'You are a professional assistant representing Shazu Soft Technologies. SST provides software development, student certified internships, faculty AI training, and scientific research publication conferences support in Salem and Namakkal, Tamil Nadu. Answer queries professionally and keep it under 3 sentences.'
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
        
        // Friendly static fallback info
        const fallbackReplies = [
          "Thank you for your interest! Shazu Soft Technologies offers professional web services, patents consult, AI curriculum training, and peer-reviewed journals support. You can reach our Salem campus at +91 93616 80077 or email info@shazusofttechnologies.org.",
          "Our Salem address: 2nd Agraharam, Chairman Rajarathinam Street, Near Kamala Hospital, Salem - 636001. We are open Mon-Sat 9AM-6PM.",
          "We offer certified internships for engineering students and academic publishing services for research scholars. Let us know if you need registration details!"
        ];
        // Select random fallback
        const randomReply = fallbackReplies[Math.floor(Math.random() * fallbackReplies.length)];
        addMessage(randomReply, false);
      }
    });
  }
});

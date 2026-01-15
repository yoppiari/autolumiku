import re

# Read file
with open(r"d:\Project\auto\autolumiku\src\app\dashboard\whatsapp-ai\conversations\page.tsx", 'r', encoding='utf-8') as f:
    content = f.read()

# Find and replace the inbound message section
old_inbound = r'''                                \{msg\.direction === 'inbound' && \(
                                  <div className="flex items-center space-x-1\.5 md:space-x-1 mb-1 md:mb-0\.5">
                                    <span className="text-\[11px\] md:text-\[10px\] font-semibold text-green-700">
                                      \{msg\.senderType === 'staff' \? '👨‍💼' : '👤'\}
                                    </span>
                                    \{msg\.intent && \(
                                      <span className="text-\[11px\] md:text-\[10px\] text-gray-500">\{msg\.intent\.replace\('customer_', ''\)\.replace\('staff_', ''\)\}</span>
                                    \)\}
                                  </div>
                                \)\}
                                \{msg\.direction === 'outbound' && \(
                                  <div className="flex items-center space-x-1\.5 md:space-x-1 mb-1 md:mb-0\.5">
                                    <span className="text-\[11px\] md:text-\[10px\] font-semibold text-blue-700">
                                      \{msg\.senderType === 'ai' \? '🤖' : '👨‍💼'\}
                                    </span>
                                  </div>
                                \)\}'''

new_inbound = '''                                {msg.direction === 'inbound' && (
                                  <div className="flex items-center space-x-1.5 md:space-x-1 mb-1 md:mb-0.5">
                                    <span className="text-[11px] md:text-[10px] font-semibold text-green-700">
                                      👨‍💼 →
                                    </span>
                                    <span className="text-[11px] md:text-[10px] font-bold text-gray-800">
                                      {(() => {
                                        if (selectedConversation?.isStaff) {
                                          const intent = msg.intent || '';
                                          if (intent.includes('owner')) return 'Owner';
                                          if (intent.includes('admin')) return 'Admin';
                                          if (intent.includes('sales') || msg.senderType === 'staff') return 'Staff';
                                          return 'Staff';
                                        }
                                        return 'Customer';
                                      })()}
                                    </span>
                                    {msg.intent && (
                                      <span className="text-[11px] md:text-[10px] text-gray-500">
                                        • {msg.intent.replace('customer_', '').replace('staff_', '')}
                                      </span>
                                    )}
                                  </div>
                                )}
                                {msg.direction === 'outbound' && (
                                  <div className="flex items-center space-x-1.5 md:space-x-1 mb-1 md:mb-0.5">
                                    <span className="text-[11px] md:text-[10px] font-semibold text-blue-700">
                                      {msg.senderType === 'ai' || msg.aiResponse ? '🤖 →' : '👨‍💼 →'}
                                    </span>
                                    <span className="text-[11px] md:text-[10px] font-bold text-gray-800">
                                      {msg.senderType === 'ai' || msg.aiResponse 
                                        ? (aiConfig?.aiName || 'AI Assistant')
                                        : 'Admin'
                                      }
                                    </span>
                                  </div>
                                )}'''

# Try to replace
if re.search(old_inbound, content):
    content = re.sub(old_inbound, new_inbound, content)
    print("✅ Pattern matched and replaced!")
else:
    print("⚠️ Pattern not found with regex. Trying simple string search...")
    # Simple line-based search
    lines = content.split('\n')
    for i, line in enumerate(lines):
        if "msg.senderType === 'staff' ? '👨‍💼' : '👤'" in line:
            print(f"Found at line {i+1}")
            break

# Write back
with open(r"d:\Project\auto\autolumiku\src\app\dashboard\whatsapp-ai\conversations\page.tsx", 'w', encoding='utf-8') as f:
    f.write(content)

print("Done!")

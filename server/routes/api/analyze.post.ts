interface AnalyzeRequest {
  fields: Record<string, string>
}

interface Issue {
  type: string
  message: string
  severity: 'low' | 'medium' | 'high'
}

interface Suggestion {
  field: string
  original: string
  suggested: string
  reason: string
}

interface AnalyzeResponse {
  score: number
  issues: Issue[]
  suggestions: Suggestion[]
}

export default defineEventHandler(async (event): Promise<AnalyzeResponse> => {
  const body = await readBody<AnalyzeRequest>(event)

  if (!body?.fields) {
    throw createError({
      statusCode: 400,
      message: 'Missing required field: fields'
    })
  }

  // Simulate processing delay
  await new Promise((resolve) => setTimeout(resolve, 800))

  const issues: Issue[] = []
  const suggestions: Suggestion[] = []
  let score = 100

  // Check if we have any content to analyze
  const fieldEntries = Object.entries(body.fields)
  if (fieldEntries.length === 0) {
    return {
      score: 0,
      issues: [{
        type: 'no-content',
        message: 'No Rich Text fields found to analyze',
        severity: 'high',
      }],
      suggestions: [],
    }
  }

  // Analyze each field
  for (const [fieldId, content] of fieldEntries) {
    if (!content || content.trim().length === 0) {
      issues.push({
        type: 'empty-field',
        message: `Field "${fieldId}" is empty`,
        severity: 'medium',
      })
      score -= 15
      continue
    }

    const wordCount = content.split(/\s+/).filter(Boolean).length

    // Check content length
    if (wordCount < 50) {
      issues.push({
        type: 'short-content',
        message: `Field "${fieldId}" has only ${wordCount} words. Consider adding more detail.`,
        severity: 'medium',
      })
      score -= 10
    }

    // Check for common issues
    if (content.toLowerCase().includes('click here')) {
      issues.push({
        type: 'vague-cta',
        message: `Field "${fieldId}": Avoid vague link text like "click here"`,
        severity: 'low',
      })
      score -= 5
    }

    // Check for passive voice indicators (simple heuristic)
    const passivePatterns = /\b(was|were|been|being|is|are)\s+\w+ed\b/gi
    const passiveMatches = content.match(passivePatterns)
    if (passiveMatches && passiveMatches.length > 3) {
      issues.push({
        type: 'passive-voice',
        message: `Field "${fieldId}": Consider using more active voice`,
        severity: 'low',
      })
      score -= 5
    }

    // Generate a mock suggestion
    if (wordCount >= 20) {
      const firstSentence = content.split(/[.!?]/)[0]
      if (firstSentence && firstSentence.length > 10) {
        suggestions.push({
          field: fieldId,
          original: firstSentence.slice(0, 60) + (firstSentence.length > 60 ? '...' : ''),
          suggested: `**Key Point:** ${firstSentence.slice(0, 60)}...`,
          reason: 'Adding emphasis to opening statements improves engagement',
        })
      }
    }
  }

  // Ensure score stays within bounds
  score = Math.max(0, Math.min(100, score))

  return {
    score,
    issues,
    suggestions,
  }
})

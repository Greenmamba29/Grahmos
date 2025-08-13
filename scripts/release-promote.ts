#!/usr/bin/env node

import { execSync } from 'child_process'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

interface ReleaseArgs {
  from: string
  to: string
  dryRun?: boolean
}

function parseArgs(): ReleaseArgs {
  const args = process.argv.slice(2)
  const from = args.find(arg => arg.startsWith('--from='))?.split('=')[1]
  const to = args.find(arg => arg.startsWith('--to='))?.split('=')[1]
  const dryRun = args.includes('--dry-run')

  if (!from || !to) {
    console.error('Usage: release-promote.ts --from=v0.1.0-rc1 --to=v0.1.0 [--dry-run]')
    process.exit(1)
  }

  return { from, to, dryRun }
}

function getCommitsBetweenTags(from: string, to: string): string[] {
  try {
    const range = to === from ? `${from}..HEAD` : `${from}..${to}`
    const output = execSync(`git log --pretty=format:"- %s (%h)" ${range}`, { encoding: 'utf8' })
    return output.split('\n').filter(line => line.trim())
  } catch (error) {
    // If the 'to' tag doesn't exist yet, get commits from 'from' to HEAD
    try {
      const output = execSync(`git log --pretty=format:"- %s (%h)" ${from}..HEAD`, { encoding: 'utf8' })
      return output.split('\n').filter(line => line.trim())
    } catch (e) {
      console.error(`Error getting commits: ${error}`)
      return []
    }
  }
}

function categorizeCommits(commits: string[]): { features: string[], fixes: string[], chores: string[] } {
  const categories = { features: [], fixes: [], chores: [] }
  
  commits.forEach(commit => {
    const lower = commit.toLowerCase()
    if (lower.includes('feat:') || lower.includes('add ') || lower.includes('implement ')) {
      categories.features.push(commit)
    } else if (lower.includes('fix:') || lower.includes('bug') || lower.includes('error')) {
      categories.fixes.push(commit)
    } else {
      categories.chores.push(commit)
    }
  })
  
  return categories
}

function generateChangelogSection(version: string, commits: string[]): string {
  const today = new Date().toISOString().split('T')[0]
  const { features, fixes, chores } = categorizeCommits(commits)
  
  let section = `## [${version}] - ${today}\n\n`
  
  if (features.length > 0) {
    section += '### Added\n'
    features.forEach(commit => section += `${commit}\n`)
    section += '\n'
  }
  
  if (fixes.length > 0) {
    section += '### Fixed\n'
    fixes.forEach(commit => section += `${commit}\n`)
    section += '\n'
  }
  
  if (chores.length > 0) {
    section += '### Changed\n'
    chores.forEach(commit => section += `${commit}\n`)
    section += '\n'
  }
  
  return section
}

function updateChangelog(version: string, newSection: string, dryRun: boolean = false): void {
  const changelogPath = join(process.cwd(), 'CHANGELOG.md')
  let content = ''
  
  if (existsSync(changelogPath)) {
    content = readFileSync(changelogPath, 'utf8')
  } else {
    content = `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

`
  }
  
  // Insert new section after the first '## ' line or after '## [Unreleased]' if it exists
  const lines = content.split('\n')
  let insertIndex = lines.findIndex(line => line.startsWith('## [Unreleased]'))
  
  if (insertIndex === -1) {
    insertIndex = lines.findIndex((line, i) => i > 0 && line.startsWith('## '))
  }
  
  if (insertIndex === -1) {
    // No existing releases, add at the end
    insertIndex = lines.length
  } else if (lines[insertIndex].includes('Unreleased')) {
    // Insert after the unreleased section
    insertIndex += 1
    while (insertIndex < lines.length && lines[insertIndex].trim() === '') {
      insertIndex++
    }
  }
  
  const updatedLines = [
    ...lines.slice(0, insertIndex),
    newSection,
    ...lines.slice(insertIndex)
  ]
  
  const updatedContent = updatedLines.join('\n')
  
  if (dryRun) {
    console.log('\\n--- CHANGELOG.md diff ---')
    console.log(newSection)
    console.log('--- End diff ---\\n')
  } else {
    writeFileSync(changelogPath, updatedContent)
    console.log(`Updated CHANGELOG.md with ${version} release notes`)
  }
}

function createTag(version: string, dryRun: boolean = false): void {
  const message = `Release ${version}`
  
  if (dryRun) {
    console.log(`Would create annotated tag: ${version}`)
    console.log(`Tag message: ${message}`)
  } else {
    try {
      execSync(`git tag -a ${version} -m "${message}"`, { stdio: 'inherit' })
      console.log(`Created annotated tag: ${version}`)
      
      console.log(`\\nTo push the tag, run:`)
      console.log(`  git push origin ${version}`)
    } catch (error) {
      console.error(`Error creating tag: ${error}`)
      process.exit(1)
    }
  }
}

function main() {
  const { from, to, dryRun } = parseArgs()
  
  console.log(`Promoting release from ${from} to ${to}${dryRun ? ' (dry run)' : ''}`)
  
  // Get commits between tags
  const commits = getCommitsBetweenTags(from, to)
  
  if (commits.length === 0) {
    console.warn(`No commits found between ${from} and ${to}`)
    return
  }
  
  console.log(`Found ${commits.length} commits to include in changelog:`)
  commits.forEach(commit => console.log(`  ${commit}`))
  console.log()
  
  // Generate changelog section
  const changelogSection = generateChangelogSection(to, commits)
  
  // Update CHANGELOG.md
  updateChangelog(to, changelogSection, dryRun)
  
  // Create tag
  createTag(to, dryRun)
  
  if (!dryRun) {
    console.log(`\\nRelease ${to} promoted successfully!`)
    console.log('Next steps:')
    console.log('1. Review CHANGELOG.md')
    console.log(`2. git push origin ${to}`)
    console.log('3. Create GitHub release from the tag')
  }
}

// Check if this file is being run directly (not imported)
if (import.meta.url.endsWith(process.argv[1]) || import.meta.url.includes('release-promote')) {
  main()
}

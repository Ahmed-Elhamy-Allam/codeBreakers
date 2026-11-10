export interface Snippet {
  id: number
  code: string
  language: string
  options: string[]
}

// "Guess the code" rounds: a snippet is shown and the player picks the
// language it is written in. `options` always includes the correct `language`.
export const snippets: Snippet[] = [
  {
    id: 1,
    language: 'Python',
    options: ['Python', 'Ruby', 'JavaScript', 'Go'],
    code: `def greet(name):
    return f"Hello, {name}!"

print(greet("world"))`,
  },
  {
    id: 2,
    language: 'Rust',
    options: ['Go', 'Rust', 'C++', 'Swift'],
    code: `fn main() {
    let numbers = vec![1, 2, 3];
    let sum: i32 = numbers.iter().sum();
    println!("Sum is {}", sum);
}`,
  },
  {
    id: 3,
    language: 'TypeScript',
    options: ['JavaScript', 'TypeScript', 'Dart', 'Kotlin'],
    code: `interface User {
  id: number
  name: string
}

const toLabel = (u: User): string => \`#\${u.id} \${u.name}\``,
  },
  {
    id: 4,
    language: 'Go',
    options: ['Go', 'Rust', 'C', 'Python'],
    code: `package main

import "fmt"

func main() {
    for i := 0; i < 3; i++ {
        fmt.Println("tick", i)
    }
}`,
  },
  {
    id: 5,
    language: 'Ruby',
    options: ['Python', 'Ruby', 'Elixir', 'Perl'],
    code: `[1, 2, 3].each do |n|
  puts "n is #{n}"
end`,
  },
  {
    id: 6,
    language: 'Swift',
    options: ['Kotlin', 'Swift', 'Dart', 'Java'],
    code: `let names = ["Ada", "Alan", "Grace"]
let greetings = names.map { "Hi, \\($0)!" }
print(greetings)`,
  },
  {
    id: 7,
    language: 'C#',
    options: ['Java', 'C#', 'C++', 'Kotlin'],
    code: `var scores = new List<int> { 10, 20, 30 };
var total = scores.Sum();
Console.WriteLine($"Total: {total}");`,
  },
  {
    id: 8,
    language: 'Haskell',
    options: ['Haskell', 'Elm', 'OCaml', 'F#'],
    code: `double :: Int -> Int
double x = x * 2

main = print (map double [1, 2, 3])`,
  },
]

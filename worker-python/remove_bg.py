import sys
import argparse
import os

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    
    if not os.path.exists(args.input):
        print(f"Error: Input file {args.input} does not exist.", file=sys.stderr)
        sys.exit(1)
        
    try:
        from rembg import remove
        from PIL import Image
        
        # Load image
        input_image = Image.open(args.input)
        
        # Remove background using rembg
        output_image = remove(input_image)
        
        # Save output
        output_image.save(args.output, "PNG")
        print(f"Success: Saved background removed image to {args.output}")
    except Exception as e:
        print(f"Error removing background: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
